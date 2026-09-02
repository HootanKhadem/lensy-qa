function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  adminUrl: () => required('ADMIN_URL'),
  storefrontUrl: () => required('STOREFRONT_URL'),
  adminEmail: () => required('ADMIN_EMAIL'),
  adminPassword: () => required('ADMIN_PASSWORD'),
  customerEmail: () => required('CUSTOMER_EMAIL'),
  customerPassword: () => required('CUSTOMER_PASSWORD'),
  supplierEmail: () => required('SUPPLIER_EMAIL'),
  supplierPassword: () => required('SUPPLIER_PASSWORD'),
};
