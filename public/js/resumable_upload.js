window.ResumableUpload = {

    upload(file)
    {

       const uppy =
new Uppy.Uppy({

            autoProceed: true,

            restrictions: {
                maxNumberOfFiles: 1
            }

        });

uppy.use(Uppy.Tus, {

    endpoint: '/tus/upload',

    retryDelays: [0,1000,3000,5000],

    chunkSize: 5 * 1024 * 1024,

    withCredentials: true,

    headers: {
        'X-CSRF-TOKEN':
        document.querySelector(
            'meta[name="csrf-token"]'
        ).content
    }

});


     uppy.on(
    'upload-success',
    (file, response) =>
{

    fetch('/tus/complete', {

        method: 'POST',

        headers: {
            'Content-Type':
            'application/json',

            'X-CSRF-TOKEN':
            document.querySelector(
                'meta[name="csrf-token"]'
            ).content
        },

        body: JSON.stringify({

            upload_url:
            response.uploadURL,

            chat_id:
            window.currentChatId,

            file_name: file.name,

            file_type: file.type,

            file_size: file.size

        })

    });

});


        uppy.addFile({

            name: file.name,

            type: file.type,

            data: file

        });

    }

};