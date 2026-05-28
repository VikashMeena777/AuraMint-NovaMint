declare module "@cashfreepayments/cashfree-js" {
  interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_top";
    returnUrl?: string;
  }

  interface CashfreeInstance {
    checkout(options: CashfreeCheckoutOptions): Promise<void>;
  }

  interface LoadOptions {
    mode: "sandbox" | "production";
  }

  export function load(options: LoadOptions): Promise<CashfreeInstance>;
}
