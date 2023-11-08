const { onValueWritten } = require("firebase-functions/v2/database");
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const https = require('https');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require("firebase-admin");
admin.initializeApp();

// Your Airtable API key and base ID
const airtableApiKey = 'patjhvKvHgEcGFLzQ.cd819c872c9e0fae4c1093b7da6bc7f379a82c4af7f0a622c46f894aefc0d70a';
const airtableBaseId = 'appScnYXvUlOmiyTj';
const airtableTable = 'Universities'; // Replace with your table name

// Create an endpoint that take a GET request with the userId and return the universities followed by the user in an array
exports.getFollowedUniversities = onRequest(async (req, res) => {
    const userId = req.query.userId;
    const universities = [];

    const followedUniversities = await admin.database().ref(`/users/${userId}/followed`).once('value');
    followedUniversities.forEach((university) => {
        // If the university is followed, add it to the array
        if (university.val()) {
            universities.push(university.key);
        }
    });

    const universitiesResult = {
        "followedUniversities": universities
    }

    res.json(universitiesResult);
});

exports.syncUniversityData = onValueWritten(
    "/universitiesData/{universityId}/advices/{adviceName}/{recordId}",
    async (event) => {
        const universityId = event.params.universityId;
        const adviceName = event.params.adviceName;
        const recordId = event.params.recordId;
        var options = {}
        var airtableData = {}

        // Exit when the data is deleted.
        if (!event.data.after.exists()) {
            const oldValue = event.data.before.val();

            options = {
                hostname: 'api.airtable.com',
                path: `/v0/${airtableBaseId}/${airtableTable}/${oldValue.id}`,
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${airtableApiKey}`,
                    'Content-Type': 'application/json',
                }
            };
        } else {
            const newValue = event.data.after.val();

            if (event.data.before.exists()) {
                options = {
                    hostname: 'api.airtable.com',
                    path: `/v0/${airtableBaseId}/${airtableTable}/${newValue.id}`,
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${airtableApiKey}`,
                        'Content-Type': 'application/json',
                    }
                };
            } else {
                options = {
                    hostname: 'api.airtable.com',
                    path: `/v0/${airtableBaseId}/${airtableTable}`,
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${airtableApiKey}`,
                        'Content-Type': 'application/json',
                    }
                };
            }

            // Prepare the data to send to Airtable
            airtableData =
            {
                "fields": {
                    "universityId": universityId,
                    "adviceType": adviceName,
                    "advisorName": newValue.advisorName,
                    "advisorId": newValue.advisorId,
                    "title": newValue.title,
                    "description": newValue.description
                }
            }
                ;

            logger.log("New trigger", universityId, adviceName, recordId, airtableData.fields.universityId);
        }

        const airtableRequest = https.request(options, (airtableResponse) => {
            let data = '';
            airtableResponse.on('data', (chunk) => {
                data += chunk;
            });

            airtableResponse.on('end', () => {
                logger.log('Airtable record updated:', data);

                // Verify if the Airtable response has an ID
                if (!JSON.parse(data).id) {
                    logger.error('Error updating Airtable record:', data);
                    return;
                }

                // Update the Firebase record with the Airtable ID
                if (!event.data.before.exists()) {
                    event.data.after.ref.child('id').set(JSON.parse(data).id);
                }
            });
        });

        airtableRequest.on('error', (error) => {
            logger.error('Error updating Airtable record:', error);
        });

        if (event.data.after.exists()) {
            airtableRequest.write(JSON.stringify(airtableData));
        }

        airtableRequest.end();
    }
)