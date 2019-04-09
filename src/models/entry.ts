export default interface Entry {
    url?: string;
    type?: string;
    name?: string;
    path?: string;
    category?: string;
    subcategory?: string;
    description?: string;
    addresses?: string[];
    reporter?: string;
    severity?: number;
    featured?: boolean;
    domain?: string;
}
