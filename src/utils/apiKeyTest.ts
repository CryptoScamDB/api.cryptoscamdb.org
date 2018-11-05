export const isValidApiKey = (input: string): boolean => {
    // TODO: replace this logic to allow multi-key functionality.
    if (input === 'TestApiKey') {
        return true;
    } else {
        return false;
    }
};

export const apiKeyOwner = (input: string): string => {
    const apiKeys = {
        TestApiKey: {
            key: 'TestApiKey',
            name: 'Tester'
        }
    };

    if (isValidApiKey(input)) {
        const index = apiKeys[input];
        return index.name;
    } else {
        return 'Invalid Api Key';
    }
};
