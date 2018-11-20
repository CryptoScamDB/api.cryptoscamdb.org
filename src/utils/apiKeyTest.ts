import * as request from 'request';

export const apiKeyOwner = async (input: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        const options = {
            uri: 'https://9441laq953.execute-api.us-east-1.amazonaws.com/prod/getapiname/',
            headers: {
                'x-api-key': input,
                data: input
            }
        };

        request(options, (err, result, body) => {
            if (err) {
                resolve(undefined);
            } else {
                body = JSON.parse(body);
                if (result.statusCode !== 200) {
                    reject('Invalid api key');
                } else {
                    if (body.body.success !== undefined && body.body.success !== false) {
                        resolve(JSON.parse(body).body.name);
                    } else {
                        resolve('unknown');
                    }
                }
            }
        });
    });
};
