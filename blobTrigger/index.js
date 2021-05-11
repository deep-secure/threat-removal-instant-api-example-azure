const axios = require('axios')
const mime = require('mime-types')
const storage = require('@azure/storage-blob');
const path = require('path')

const API_ENDPOINT_BASE = process.env['API_ENDPOINT_BASE']
const API_KEY = process.env['API_KEY']
const fileStorage = process.env['fileStorage']
const containerClient = storage.BlobServiceClient.fromConnectionString(fileStorage).getContainerClient('input')

module.exports.index = async function(context, inputBlob) {
const inputBlobName = path.basename(context.bindingData.blobTrigger)
    try {
        context.log("Instant Api blob trigger function triggered by", inputBlobName, "(filesize:", inputBlob.length, "Bytes)")

        const guessedMimeType = mime.lookup(inputBlobName)
        if(guessedMimeType) 
            context.log("Guessed mime type for", inputBlobName, "is", guessedMimeType)
        else
            throw new Error("Mime type could not be guessed (missing or unknown suffix)")

        const response = await upload(
            API_ENDPOINT_BASE,
            API_KEY,
            inputBlob,
            guessedMimeType
        )
        
        containerClient.getBlockBlobClient(inputBlobName).deleteIfExists()

        context.log("file", inputBlobName, "successfully transformed\n")

        return {
            successBlob: response.data
        }
    }
    catch(err) {
        containerClient.getBlockBlobClient(inputBlobName).deleteIfExists()

        context.log.error("An error has occured during the processing of", inputBlobName)

        if(err.response && err.response.data) {
            context.log.error(err.response.data, "\n")
            return {
                errorBlob: err.response.data
            }
        }
        else {
            const errorJson = {"error": {"type": "INSTANT_API_CODE_SAMPLE_ERROR", "message": err.message}};
            context.log.error(errorJson, "\n")
            return {
                errorBlob: errorJson
            }
        }
    }
};

async function upload(apiEndpointBase, apiKey, inputBlob, mimeType) {
    try {
        const response = await axios({
            method: 'POST',
            headers: {
                'Accept': [mimeType, 'application/json'].join(', '),
                'Content-Type': mimeType,
                'x-api-key': apiKey
            },
            responseType: 'arraybuffer',
            url: apiEndpointBase + '/upload',
            maxContentLength: Math.max(20000, inputBlob.length),
            maxBodyLength: Math.max(20000, inputBlob.length * 3),
            data: inputBlob
        })

        return response
    }
    catch (err) {
        if (err.response && err.response.data) err.response.data = JSON.parse(err.response.data)
        throw err
    }
}