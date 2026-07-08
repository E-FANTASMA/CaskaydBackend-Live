export interface FlutterwaveInitializeResponse {
  link: string;
  reference: string;
}

export interface FlutterwaveVerificationResponse {
  status: string;
  tx_ref?: string;
  id?: number;
  amount?: number;
  currency?: string;
}
