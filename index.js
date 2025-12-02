import init, { P2PClient } from '../p2p-messaging-wasm/pkg/p2p_messaging_wasm.js';

// --- P2P Connection Class ---
class P2PConnection {
    constructor(peerId, manager) {
        this.peerId = peerId;
        this.manager = manager;
        this.dataChannel = null;

        const config = {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        };
        this.pc = new RTCPeerConnection(config);

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.manager.sendSignal(this.peerId, {
                    type: 'candidate',
                    candidate: event.candidate
                });
            }
        };

        this.pc.onconnectionstatechange = () => {
            console.log(`Connection state with ${this.peerId}: ${this.pc.connectionState}`);
            this.manager.updatePeerStatus(this.peerId, this.pc.connectionState);
        };

        this.pc.ondatachannel = (event) => {
            console.log(`Data channel received from ${this.peerId}`);
            this.setupDataChannel(event.channel);
        };
    }

    setupDataChannel(channel) {
        this.dataChannel = channel;
        this.dataChannel.onopen = () => {
            console.log(`Data channel open with ${this.peerId}`);
            this.manager.updatePeerStatus(this.peerId, 'connected');
        };
        this.dataChannel.onmessage = (event) => {
            try {
                const decrypted = window.p2pClient.decrypt_message(this.peerId, event.data);
                this.manager.handlePeerMessage(this.peerId, decrypted);
            } catch (e) {
                console.error("Failed to decrypt message:", e);
                this.manager.handlePeerMessage(this.peerId, "[Decryption Failed]");
            }
        };
    }

    async createOffer() {
        this.dataChannel = this.pc.createDataChannel("chat");
        this.setupDataChannel(this.dataChannel);

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        return offer;
    }

    async createAnswer(offerSdp) {
        await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        return answer;
    }

    async receiveAnswer(answerSdp) {
        await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
    }

    async addIceCandidate(candidate) {
        try {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error("Error adding ice candidate", e);
        }
    }

    sendMessage(msg) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            try {
                const encrypted = window.p2pClient.encrypt_message(this.peerId, msg);
                this.dataChannel.send(encrypted);
            } catch (e) {
                console.error("Failed to encrypt message:", e);
            }
        } else {
            console.warn(`Data channel with ${this.peerId} is not open`);
        }
    }

    close() {
        if (this.dataChannel) this.dataChannel.close();
        this.pc.close();
    }
}

// --- Peer Manager Class ---
class PeerManager {
    constructor(url, username, room) {
        this.username = username;
        this.room = room;
        this.peers = new Map(); // peerId -> P2PConnection
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log("Connected to signaling server");
            this.login();
        };

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            this.handleSignalMessage(msg);
        };

        this.ws.onerror = (err) => console.error("WebSocket error:", err);
    }

    login() {
        this.ws.send(JSON.stringify({
            type: "Login",
            payload: { username: this.username }
        }));

        // Join room after a short delay to ensure login is processed
        setTimeout(() => {
            this.ws.send(JSON.stringify({
                type: "Join",
                payload: { room: this.room }
            }));
        }, 500);
    }

    async handleSignalMessage(msg) {
        console.log("Received:", msg);
        const { type, payload } = msg;

        switch (type) {
            case "PeerJoined":
                this.addPeer(payload.peer_id, payload.username, true); // true = initiate connection
                ui.addSystemMessage(`${payload.username} joined the room.`);
                break;

            case "PeerLeft":
                this.removePeer(payload.peer_id);
                ui.addSystemMessage(`Peer ${payload.peer_id} left.`);
                break;

            case "ExistingPeers":
                payload.peers.forEach(p => {
                    this.addPeer(p.peer_id, p.username, false); // false = wait for offer
                });
                break;

            case "Signal":
                await this.handleWebRTCSignal(payload.target, payload.data);
                break;
        }
    }

    addPeer(peerId, username, shouldCreateOffer) {
        if (this.peers.has(peerId)) return;

        const conn = new P2PConnection(peerId, this);
        this.peers.set(peerId, conn);
        ui.addPeerToList(peerId, username);

        // Send Public Key
        try {
            const myPubKey = window.p2pClient.get_public_key();
            this.sendSignal(peerId, {
                type: 'key-exchange',
                key: myPubKey
            });
        } catch (e) {
            console.error("Failed to send public key:", e);
        }

        if (shouldCreateOffer) {
            console.log(`Creating offer for ${peerId}`);
            conn.createOffer().then(offer => {
                this.sendSignal(peerId, {
                    type: 'offer',
                    sdp: offer.sdp
                });
            });
        }
    }

    removePeer(peerId) {
        const conn = this.peers.get(peerId);
        if (conn) {
            conn.close();
            this.peers.delete(peerId);
        }
        ui.removePeerFromList(peerId);
    }

    async handleWebRTCSignal(senderId, data) {
        // If we receive a signal from a peer we don't know yet (e.g. they were already in room),
        // we should have added them via ExistingPeers. 
        // But just in case, or for the passive side:
        if (!this.peers.has(senderId)) {
            // We might not know the username here if we missed the ExistingPeers or Join
            // For now use ID as username fallback
            this.addPeer(senderId, senderId, false);
        }

        const conn = this.peers.get(senderId);

        if (data.type === 'offer') {
            console.log(`Received offer from ${senderId}`);
            const answer = await conn.createAnswer(data.sdp);
            this.sendSignal(senderId, {
                type: 'answer',
                sdp: answer.sdp
            });
        } else if (data.type === 'answer') {
            console.log(`Received answer from ${senderId}`);
            await conn.receiveAnswer(data.sdp);
        } else if (data.candidate) {
            console.log(`Received candidate from ${senderId}`);
            await conn.addIceCandidate(data.candidate);
        } else if (data.type === 'key-exchange') {
            console.log(`Received public key from ${senderId}`);
            try {
                window.p2pClient.handle_peer_key(senderId, data.key);
                console.log(`Shared secret established with ${senderId}`);
            } catch (e) {
                console.error("Failed to handle peer key:", e);
            }
        }
    }

    sendSignal(targetId, data) {
        this.ws.send(JSON.stringify({
            type: "Signal",
            payload: {
                target: targetId,
                data: data
            }
        }));
    }

    broadcastMessage(text) {
        this.peers.forEach(conn => {
            conn.sendMessage(text);
        });
        // Also show own message
        ui.addMessage("You", text, 'sent');
    }

    handlePeerMessage(peerId, text) {
        // Find username from UI list or store it in PeerManager
        const username = ui.getPeerName(peerId) || peerId;
        ui.addMessage(username, text, 'received');
    }

    updatePeerStatus(peerId, status) {
        ui.updatePeerStatus(peerId, status);
    }
}

// --- UI Logic ---
const ui = {
    loginContainer: document.getElementById('login-container'),
    appContainer: document.getElementById('app-container'),
    usernameInput: document.getElementById('username-input'),
    roomInput: document.getElementById('room-input'),
    loginBtn: document.getElementById('login-btn'),
    peersList: document.getElementById('peers-list'),
    messages: document.getElementById('messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),

    peerNames: new Map(), // peerId -> username

    async init() {
        // Initialize WASM
        await init();
        window.p2pClient = new P2PClient();
        const pubKey = window.p2pClient.generate_keys();
        console.log("Generated Public Key:", pubKey);

        this.loginBtn.addEventListener('click', () => this.handleLogin());
        this.sendBtn.addEventListener('click', () => this.handleSend());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSend();
        });

        // Mobile sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const closeSidebar = document.getElementById('close-sidebar');
        const sidebar = document.getElementById('sidebar');

        const toggleSidebar = () => {
            sidebar.classList.toggle('active');
        };

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleSidebar);
        }

        if (closeSidebar) {
            closeSidebar.addEventListener('click', toggleSidebar);
        }

        // Close sidebar when clicking on a peer on mobile
        this.peersList.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && e.target.closest('.peer-item')) {
                sidebar.classList.remove('active');
            }
        });
    },

    handleLogin() {
        const username = this.usernameInput.value.trim();
        const room = this.roomInput.value.trim() || "general";

        if (!username) {
            alert("Please enter a username");
            return;
        }

        this.loginContainer.style.display = 'none';
        this.appContainer.style.display = 'flex';

        // Initialize PeerManager
        window.peerManager = new PeerManager("wss://p2p-message-signaling-rwjs.shuttle.app/ws", username, room);
    },

    handleSend() {
        const text = this.messageInput.value.trim();
        if (!text) return;

        if (window.peerManager) {
            window.peerManager.broadcastMessage(text);
            this.messageInput.value = '';
        }
    },

    addPeerToList(peerId, username) {
        this.peerNames.set(peerId, username);

        const div = document.createElement('div');
        div.className = 'peer-item';
        div.id = `peer-${peerId}`;
        div.innerHTML = `
            <span>${username}</span>
            <div class="peer-status" id="status-${peerId}"></div>
        `;
        this.peersList.appendChild(div);
    },

    removePeerFromList(peerId) {
        this.peerNames.delete(peerId);
        const el = document.getElementById(`peer-${peerId}`);
        if (el) el.remove();
    },

    updatePeerStatus(peerId, status) {
        const el = document.getElementById(`status-${peerId}`);
        if (el) {
            if (status === 'connected') {
                el.classList.add('connected');
            } else {
                el.classList.remove('connected');
            }
        }
    },

    addMessage(sender, text, type) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.innerHTML = `<strong>${sender}:</strong> ${text}`;
        this.messages.appendChild(div);
        this.messages.scrollTop = this.messages.scrollHeight;
    },

    addSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'message system';
        div.textContent = text;
        this.messages.appendChild(div);
        this.messages.scrollTop = this.messages.scrollHeight;
    },

    getPeerName(peerId) {
        return this.peerNames.get(peerId);
    }
};

ui.init();
