// DO NOT redeclare Echo variable
// Use window.Echo from echo.iife.js

const EchoConstructor =
    window.Echo?.default || window.Echo;

const isNgrok = window.location.protocol === 'https:'
    && !window.location.hostname.includes('localhost')
    && !window.location.hostname.includes('127.0.0.1');

const wsHost  = window.location.hostname;
const wsPort  = isNgrok ? 443 : 8080;
const forceTLS = isNgrok;

window.EchoInstance = new EchoConstructor({
    broadcaster: 'reverb',
    key: 'local',
    wsHost:  wsHost,
    wsPort:  wsPort,
    wssPort: wsPort,
    forceTLS: forceTLS,
    enabledTransports: ['ws', 'wss'],

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