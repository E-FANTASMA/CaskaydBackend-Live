export interface FlutterwaveCardTokenDetails {
  token: string;
  last_4digits?: string;
  first_6digits?: string;
  type?: string;
  expiry?: string;
  country?: string;
  issuer?: string;
}

export interface FlutterwaveInitializeResponse {
  link: string;
  reference: string;
}

export interface FlutterwaveVerificationResponse {
  status: string;
  tx_ref?: string;
  id?: number | string;
  amount?: number;
  currency?: string;
  card?: FlutterwaveCardTokenDetails;
  customer?: {
    id?: number;
    name?: string;
    email?: string;
  };
}

export interface FlutterwavePaymentPlanResponse {
  id: number;
  name: string;
  amount: number;
  interval: string;
  status: string;
}

export interface FlutterwaveSubscriptionResponse {
  id: number;
  status?: string;
  plan?: number;
  customer?: {
    email?: string;
  };
}

export interface FlutterwaveTokenizedChargePayload {
  token: string;
  currency: string;
  amount: number;
  email: string;
  tx_ref: string;
  first_name?: string;
  last_name?: string;
  customizations?: {
    title?: string;
    description?: string;
  };
}

export interface FlutterwaveTokenizedChargeResponse {
  status: string;
  message?: string;
  data?: {
    id?: number;
    tx_ref?: string;
    status?: string;
    amount?: number;
    currency?: string;
    charged_amount?: number;
    card?: FlutterwaveCardTokenDetails;
  };
}
