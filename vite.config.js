import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                about: resolve(__dirname, 'about.html'),
                services: resolve(__dirname, 'services.html'),
                store: resolve(__dirname, 'store.html'),
                membership: resolve(__dirname, 'membership.html'),
                gallery: resolve(__dirname, 'gallery.html'),
                contact: resolve(__dirname, 'contact.html'),
                cart: resolve(__dirname, 'cart.html'),
                checkout: resolve(__dirname, 'checkout.html'),
                orders: resolve(__dirname, 'orders.html'),
                'track-order': resolve(__dirname, 'track-order.html'),
                'payment-success': resolve(__dirname, 'payment-success.html'),
            },
        },
    },
})
