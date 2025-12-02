(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],{

/***/ "../p2p-messaging/pkg/p2p_messaging.js":
/*!*********************************************!*\
  !*** ../p2p-messaging/pkg/p2p_messaging.js ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("throw new Error(\"Module parse failed: Unexpected token (573:64)\\nYou may need an appropriate loader to handle this file type, currently no loaders are configured to process this file. See https://webpack.js.org/concepts#loaders\\n| \\n|     if (typeof module_or_path === 'undefined') {\\n>         module_or_path = new URL('p2p_messaging_bg.wasm', import.meta.url);\\n|     }\\n|     const imports = __wbg_get_imports();\");\n\n//# sourceURL=webpack:///../p2p-messaging/pkg/p2p_messaging.js?");

/***/ }),

/***/ "./index.js":
/*!******************!*\
  !*** ./index.js ***!
  \******************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var p2p_messaging__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! p2p-messaging */ \"../p2p-messaging/pkg/p2p_messaging.js\");\n/* harmony import */ var p2p_messaging__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(p2p_messaging__WEBPACK_IMPORTED_MODULE_0__);\n\n\nlet p2p = null;\n\nasync function run() {\n    await p2p_messaging__WEBPACK_IMPORTED_MODULE_0___default()();\n\n    p2p = new p2p_messaging__WEBPACK_IMPORTED_MODULE_0__[\"P2PConnectionShared\"]();\n\n    p2p.set_on_message((msg) => {\n        logMessage(\"Peer: \" + msg, \"peer-message\");\n    });\n\n    document.getElementById('btn-create-offer').onclick = async () => {\n        try {\n            const sdp = await p2p.create_offer();\n            document.getElementById('local-sdp').value = sdp;\n            console.log(\"Offer created\");\n        } catch (e) {\n            console.error(\"Error creating offer:\", e);\n            alert(\"Error: \" + e);\n        }\n    };\n\n    document.getElementById('btn-join').onclick = async () => {\n        console.log(\"Joining...\");\n        const remoteSdp = document.getElementById('remote-sdp').value;\n        if (!remoteSdp) return alert(\"Please paste the Host's Offer SDP first.\");\n\n        try {\n            const sdp = await p2p.create_answer(remoteSdp);\n            document.getElementById('local-sdp').value = sdp;\n            console.log(\"Answer created\");\n        } catch (e) {\n            console.error(\"Error creating answer:\", e);\n            alert(\"Error: \" + e);\n        }\n    };\n\n    document.getElementById('btn-receive-answer').onclick = async () => {\n        const remoteSdp = document.getElementById('remote-sdp').value;\n        if (!remoteSdp) return alert(\"Please paste the Peer's Answer SDP first.\");\n\n        try {\n            await p2p.receive_answer(remoteSdp);\n            console.log(\"Answer received, connection should be established.\");\n            alert(\"Connected!\");\n        } catch (e) {\n            console.error(\"Error receiving answer:\", e);\n            alert(\"Error: \" + e);\n        }\n    };\n\n    document.getElementById('btn-send').onclick = sendMessage;\n    document.getElementById('msg-input').onkeypress = (e) => {\n        if (e.key === 'Enter') sendMessage();\n    };\n\n    function sendMessage() {\n        const input = document.getElementById('msg-input');\n        const msg = input.value;\n        if (!msg) return;\n\n        try {\n            p2p.send_message(msg);\n            logMessage(\"Me: \" + msg, \"my-message\");\n            input.value = \"\";\n        } catch (e) {\n            console.error(\"Error sending message:\", e);\n            alert(\"Error sending: \" + e);\n        }\n    }\n\n    function logMessage(text, className) {\n        const log = document.getElementById('chat-log');\n        const div = document.createElement('div');\n        div.className = \"message \" + className;\n        div.textContent = text;\n        log.appendChild(div);\n        log.scrollTop = log.scrollHeight;\n    }\n}\n\n// Initialize when the WASM module is ready\nrun().catch(console.error);\n\n//# sourceURL=webpack:///./index.js?");

/***/ })

}]);