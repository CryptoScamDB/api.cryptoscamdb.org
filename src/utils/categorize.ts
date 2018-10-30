import * as Categorize from 'esdb-categorize';
import Entry from '../models/entry';

export const categorizeUrl = async (input: Entry) => {
    input['domain'] = input.url;
    const categorized = await new Categorize().test(input);
    delete input['domain'];
    return categorized;
};
