import init, { P2PConnectionShared } from 'p2p-messaging';

let p2p = null;

async function run() {
    await init();

    p2p = new P2PConnectionShared();

    p2p.set_on_message((msg) => {
        logMessage("Peer: " + msg, "peer-message");
    });

    document.getElementById('btn-create-offer').onclick = async () => {
        try {
            const sdp = await p2p.create_offer();
            document.getElementById('local-sdp').value = sdp;
            console.log("Offer created");
        } catch (e) {
            console.error("Error creating offer:", e);
            alert("Error: " + e);
        }
    };

    document.getElementById('btn-join').onclick = async () => {
        console.log("Joining...");
        const remoteSdp = document.getElementById('remote-sdp').value;
        if (!remoteSdp) return alert("Please paste the Host's Offer SDP first.");

        try {
            const sdp = await p2p.create_answer(remoteSdp);
            document.getElementById('local-sdp').value = sdp;
            console.log("Answer created");
        } catch (e) {
            console.error("Error creating answer:", e);
            alert("Error: " + e);
        }
    };

    document.getElementById('btn-receive-answer').onclick = async () => {
        const remoteSdp = document.getElementById('remote-sdp').value;
        if (!remoteSdp) return alert("Please paste the Peer's Answer SDP first.");

        try {
            await p2p.receive_answer(remoteSdp);
            console.log("Answer received, connection should be established.");
            alert("Connected!");
        } catch (e) {
            console.error("Error receiving answer:", e);
            alert("Error: " + e);
        }
    };

    document.getElementById('btn-send').onclick = sendMessage;
    document.getElementById('msg-input').onkeypress = (e) => {
        if (e.key === 'Enter') sendMessage();
    };

    function sendMessage() {
        const input = document.getElementById('msg-input');
        const msg = input.value;
        if (!msg) return;

        try {
            p2p.send_message(msg);
            logMessage("Me: " + msg, "my-message");
            input.value = "";
        } catch (e) {
            console.error("Error sending message:", e);
            alert("Error sending: " + e);
        }
    }

    function logMessage(text, className) {
        const log = document.getElementById('chat-log');
        const div = document.createElement('div');
        div.className = "message " + className;
        div.textContent = text;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
    }
}

// Initialize when the WASM module is ready
run().catch(console.error);