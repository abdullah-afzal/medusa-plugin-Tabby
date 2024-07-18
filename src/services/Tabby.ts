import {
    AbstractPaymentProcessor,
    CartService,
    PaymentProcessorContext,
    PaymentProcessorError,
    PaymentProcessorSessionResponse,
    PaymentSessionStatus,
} from "@medusajs/medusa";
import axios, { AxiosResponse } from "axios";
import { humanizeAmount } from "medusa-core-utils"
import { merchant } from "../types/merchants";

class MyPaymentProcessor extends AbstractPaymentProcessor {
    protected readonly cartService_: CartService;
    merchants: merchant[];
    constructor(container, options) {
        super(container)
        // options contains plugin options
        this.merchants = options.merchants
        this.cartService_ = container.cartService;
      }



    updatePaymentData(sessionId: string, data: Record<string, unknown>): Promise<Record<string, unknown> | PaymentProcessorError> {
        throw new Error("1");
    }

    static identifier = "Tabby";

    async capturePayment(paymentSessionData: Record<string, unknown>): Promise<Record<string, unknown> | PaymentProcessorError> {
        try {
            var id;
            if (paymentSessionData.hasOwnProperty("payment")) {
                // @ts-ignore
                id = paymentSessionData.payment.id;
            } else {
                id = paymentSessionData.id;
            }
            const data = {
                amount: paymentSessionData.amount
            }

            const headers = {
                authorization: `Bearer ${process.env.TABBY_TOKEN_SECRET}`,
            };


            await axios.post(`${process.env.TABBY_API}/payments/${id}/captures`, data, { headers });
            return await this.retrievePayment(paymentSessionData);
        } catch (error) {
            return error;
        }
    }
    async authorizePayment(
        paymentSessionData: Record<string, unknown>,
        context: PaymentProcessorContext
    ): Promise<PaymentProcessorError | {
        status:
        PaymentSessionStatus; data: Record<string, unknown>
    }> {
        try {

            const status = await
                this.getPaymentStatus(paymentSessionData);
            const temp = await
                this.retrievePayment(paymentSessionData);
            const data = { ...temp };

            return {
                status,
                data,
            }
        } catch (error) {
            const e: PaymentProcessorError = {
                "error": error
            }
            return e;
        }
    }

    async cancelPayment(
        paymentSessionData: Record<string, unknown>
    ): Promise<Record<string, unknown> | PaymentProcessorError> {
        return {
            id: "cancel",
        }
    }
    async initiatePayment(context: PaymentProcessorContext): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {


        const cart = await this.cartService_.retrieveWithTotals(
            context.resource_id
          );
        // const price = context.amount / 100;
        // const priceString = price.toString();
        // const formattedPrice = priceString.slice(0, 3) + "." + priceString.slice(3);
        // const success = `${process.env.WEB_ENDPOINT}/success`;
        const currency= context.currency_code;
        // console.log(context.customer)
        // const country = context.customer.billing_address?.country_code;
        const merchant = this.merchants.find((merchant) => merchant.currency === currency.toUpperCase()) 
                        || this.merchants.find((merchant) => merchant.type === "DEFAULT");
        
        const data = {
            "payment": {
                "amount": humanizeAmount(context.amount, context.currency_code),
                "currency": merchant.currency,
                "buyer": {
                    "phone": `${cart.shipping_address?.phone}`|| null,
                    "email": context.email,
                    "name": `${cart.shipping_address?.first_name+" "+cart.shipping_address?.last_name}` || null,
                },
                "shipping_address": {
                    "city": `${cart.shipping_address?.city}`|| null,
                    "address": `${cart.shipping_address?.address_1}`|| null,
                    "zip": cart.shipping_address?.postal_code || null
                },
                "order": {
                    "reference_id": context.resource_id,
                    "items": cart.items.map((item) => {
                        return {
                            title: item.title,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            category: item?.variant?.product?.categories?.map((category)=>category.name+" ") || null,
                        };
                      })
                },
                "buyer_history": {
                    "registered_since": new Date().toISOString(),
                    "loyalty_level": 0,
                },
                "order_history": [
                    {
                        "purchased_at": new Date().toISOString(),
                        "amount": humanizeAmount(context.amount, context.currency_code),
                        "status": "new",

                    }
                ],


            },
            "lang": "ar",
            "merchant_code": merchant.merchant_code,
            "merchant_urls": {
                "success": `${process.env.WEB_ENDPOINT}/checkout?paymentStatus=approved&`,
                "cancel": `${process.env.WEB_ENDPOINT}/checkout?paymentStatus=canceled&`,
                "failure": `${process.env.WEB_ENDPOINT}/checkout?paymentStatus=failed&`,
            },
        }

        const config = {
            headers: {
                Authorization: `Bearer ${process.env.TABBY_TOKEN}`,
            },
        };
        const url = `${process.env.TABBY_API}/checkout`;
        const response: AxiosResponse = await axios.post(url, data, config);
        const responseData = await response.data;


        return responseData;
    }
    async deletePayment(paymentSessionData: Record<string, unknown>): Promise<Record<string, unknown> | PaymentProcessorError> {
        return paymentSessionData;
    }
    async getPaymentStatus(
        paymentSessionData: Record<string, unknown>
    ): Promise<PaymentSessionStatus> {
        const responceData = await this.retrievePayment(paymentSessionData);
        const status = responceData["status"]

        switch (status) {
            case "AUTHORIZED":
                return PaymentSessionStatus.AUTHORIZED;
            case "CANCELED":
                return PaymentSessionStatus.CANCELED;
            case "CREATED":
                return PaymentSessionStatus.PENDING;
            case "CREATED":
                return PaymentSessionStatus.REQUIRES_MORE;
            default:
                return PaymentSessionStatus.ERROR;
        }
    }
    async refundPayment(paymentSessionData: Record<string, unknown>, refundAmount: number): Promise<Record<string, unknown> | PaymentProcessorError> {

        try {
            var id;
            if (paymentSessionData.hasOwnProperty("payment")) {
                // @ts-ignore
                id = paymentSessionData.payment.id;
            } else {
                id = paymentSessionData.id;
            }
            const data = {
                //@ts-ignore
                amount: humanizeAmount(refundAmount, paymentSessionData.currency)
            }

            const headers = {
                authorization: `Bearer ${process.env.TABBY_TOKEN_SECRET}`,
            };


            await axios.post(`${process.env.TABBY_API}/payments/${id}/refunds`, data, { headers });

            return await this.retrievePayment(paymentSessionData);
        } catch (error) {
            return error;
        }
    }
    async retrievePayment(
        paymentSessionData: Record<string, unknown>
    ): Promise<Record<string, unknown> | PaymentProcessorError> {
        try {
            var id;
            if (paymentSessionData.hasOwnProperty("payment")) {
                // @ts-ignore
                id = paymentSessionData.payment.id;
            } else {
                id = paymentSessionData.id;
            }

            const headers = {
                authorization: `Bearer ${process.env.TABBY_TOKEN_SECRET}`,
            };

            const response = await axios.get(`${process.env.TABBY_API}/payments/${id}`, { headers });
            const responseData = response.data;
            return responseData;
        } catch (error) {
            return error;
        }
    }

    async updatePayment(context: PaymentProcessorContext): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
        this.initiatePayment(context)
    }
}

export default MyPaymentProcessor;
