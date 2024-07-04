import type {
    CartService,
    MedusaRequest,
    MedusaResponse,
    OrderService,
  } from "@medusajs/medusa";
  
  export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const id= req.params.id;
    
    const cartService: CartService = req.scope.resolve("cartService");
    const orderService: OrderService = req.scope.resolve("orderService");
    try {
      const order = await orderService.retrieveByCartId(id);
      res
        .status(302)
        .redirect(`${process.env.cmi_store_home}/order/${order.id}`);
    } catch (error) {
      try {
        const ca = await cartService.authorizePayment(id);
        const data = await orderService.createFromCart(ca.id);
        res
          .status(302)
          .redirect(`${process.env.tabby_store_home}/order/${data.id}`);
      } catch (err) {
        console.error("Error completing order:", err);
        res.status(500).redirect(`${process.env.tabby_store_home}/checkout`);
      }
    }
  };
  