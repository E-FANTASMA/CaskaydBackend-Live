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
