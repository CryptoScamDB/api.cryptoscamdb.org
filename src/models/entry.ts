export default interface Entry {
    url?: string;
    name?: string;
    category?: string;
    subcategory?: string;
    description?: string;
    addresses?: string[];
    reporter?: string;
    coin?: string;
    severity?: number;
    featured?: boolean;
    domain?: string;
}
