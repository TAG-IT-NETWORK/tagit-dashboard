"use client";

// Toaster is a convenience re-export of ToastProvider.
// Drop <Toaster /> into your app root to mount the notification container.
//
// Usage:
//   import { Toaster } from "@tagit/ui";
//   // In your root layout or client shell:
//   <Toaster>{children}</Toaster>
//
//   // Or wrap a subtree:
//   <Toaster>
//     <App />
//   </Toaster>
//
//   // Then anywhere inside:
//   const { toast } = useToast();
//   toast({ title: "Saved", variant: "success" });

export { ToastProvider as Toaster } from "./toast";
