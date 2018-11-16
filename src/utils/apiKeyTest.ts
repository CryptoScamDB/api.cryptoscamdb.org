import * as request from 'request';

export const isValidApiKey = (input: string): boolean => {
    // TODO: replace this logic to allow multi-key functionality.
    return true;
};

export const apiKeyOwner = async (input: string, inputid: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        const options = {
            uri: 'https://9441laq953.execute-api.us-east-1.amazonaws.com/prod/getapiname/',
            headers: {
                'x-api-key': input,
                data: inputid
            }
        };
        console.log('Making req with: ');
        console.log(JSON.stringify(options, null, 2));
        request(options, (err, result, body) => {
            console.log(body);
            if (err) {
                console.log(err);
                resolve(undefined);
            } else {
                if (JSON.parse(body).body.success) {
                    resolve(JSON.parse(body).body.name);
                } else {
                    resolve('unknown');
                }
            }
        });
    });
};
