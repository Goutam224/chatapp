// DO NOT redeclare Echo variable
// Use window.Echo from echo.iife.js

const EchoConstructor =
    window.Echo?.default || window.Echo;

window.EchoInstance = new EchoConstructor({

    broadcaster: 'reverb',

    key: 'local',

    wsHost: window.location.hostname,

    wsPort: 8080,

    wssPort: 8080,

    forceTLS: false,

    enabledTransports: ['ws','wss'],

    authorizer: (channel, options) => ({
        authorize: (socketId, callback) => {

            fetch('/broadcasting/auth', {

                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                    document.querySelector(
                    'meta[name="csrf-token"]').content
                },

                body: JSON.stringify({
                    socket_id: socketId,
                    channel_name: channel.name
                })

            })
            .then(res => res.json())
            .then(data => callback(false, data))
            .catch(err => callback(true, err));

        }
    })

});
