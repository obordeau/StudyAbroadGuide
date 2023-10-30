const { onValueWritten } = require("firebase-functions/v2/database");
const { logger } = require("firebase-functions");
const https = require('https');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require("firebase-admin");
admin.initializeApp();

// Your Airtable API key and base ID
const airtableApiKey = 'patjhvKvHgEcGFLzQ.cd819c872c9e0fae4c1093b7da6bc7f379a82c4af7f0a622c46f894aefc0d70a';
const airtableBaseId = 'appScnYXvUlOmiyTj';
const airtableTable = 'Universities'; // Replace with your table name

exports.syncUniversityData = onValueWritten(
    "/universitiesData/{universityId}/advices/{adviceName}/{recordId}",
    (event) => {
        const universityId = event.params.universityId;
        const adviceName = event.params.adviceName;
        const recordId = event.params.recordId;
        const newValue = event.data.after.val();

        // if (event.data.before.exists()) {
        //     return null;
        //   }
        //   // Exit when the data is deleted.
        //   if (!event.data.after.exists()) {
        //     return null;
        //   }  

        logger.log("New trigger", universityId, adviceName, recordId, newValue);

        // Prepare the data to send to Airtable
        const airtableData = {
            "records": [
                {
                    "fields": {}
                },
                {
                    "fields": {}
                }
            ]
        };

        const options = {
            hostname: 'api.airtable.com',
            path: `/v0/${airtableBaseId}/${airtableTable}`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${airtableApiKey}`,
                'Content-Type': 'application/json',
            }
        };


        const airtableRequest = https.request(options, (airtableResponse) => {
            let data = '';
            airtableResponse.on('data', (chunk) => {
                data += chunk;
            });

            airtableResponse.on('end', () => {
                console.log('Airtable record updated:', data);
            });
        });

        airtableRequest.on('error', (error) => {
            console.error('Error updating Airtable record:', error);
        });

        airtableRequest.write(JSON.stringify(airtableData));
        airtableRequest.end();
    }
)