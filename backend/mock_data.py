# Intentionally corporate and bland ("good quality", "click here", "contact us") so the
# NUVOX brand refresh from Gemini is an instant, visible contrast. Images are plain
# grey placeholders (see create_mock_images.py) for the same reason.
MOCK_PAGES = {
    "/content/nuvox/us/en/products/airwave-pro": {
        "pageTitle": "NUVOX AirWave Pro",
        "pagePath": "/content/nuvox/us/en/products/airwave-pro",
        "components": [
            {
                "id": "comp-1",
                "type": "text",
                "label": "Hero Text",
                "jcrPath": "/content/nuvox/us/en/products/airwave-pro/jcr:content/root/container/text",
                "currentContent": "These are our wireless headphones. They are good quality and have nice sound. Many customers have bought them and they like them. The headphones are available in different colors. They are comfortable to wear for long periods of time. Buy them now.",
            },
            {
                "id": "comp-2",
                "type": "image",
                "label": "Hero Image",
                "jcrPath": "/content/nuvox/us/en/products/airwave-pro/jcr:content/root/container/image",
                "currentImageUrl": "/static/mock-images/boring-headphones.jpg",
                "altText": "Wireless headphones on white background",
                "imageContext": "Hero banner product shot for wireless earphones product page — main visual that customers see first",
            },
            {
                "id": "comp-3",
                "type": "accordion",
                "label": "Product Details",
                "jcrPath": "/content/nuvox/us/en/products/airwave-pro/jcr:content/root/container/accordion",
                "currentContent": "Item 1: Product Specifications\nBattery life is long. Sound quality is good. It has Bluetooth. Comes with a charging cable. The box contains headphones and some accessories.\n\nItem 2: Shipping Information\nWe ship to many places. Shipping takes some days. Free shipping is available sometimes. Track your order on our website.\n\nItem 3: Return Policy\nYou can return the product. There are some conditions. Contact customer support for returns. We try to process returns quickly.\n\nItem 4: Customer Reviews\nCustomers say the product is nice. Many people have given good ratings. Some people said the sound is great. Overall feedback is positive.",
            },
            {
                "id": "comp-4",
                "type": "image",
                "label": "Lifestyle Image",
                "jcrPath": "/content/nuvox/us/en/products/airwave-pro/jcr:content/root/container/image_1",
                "currentImageUrl": "/static/mock-images/boring-lifestyle.jpg",
                "altText": "Person wearing headphones outdoors",
                "imageContext": "Lifestyle action shot showing someone wearing NUVOX earphones while skateboarding or dancing — should feel energetic and youthful",
            },
            {
                "id": "comp-5",
                "type": "teaser",
                "label": "Promo Teaser",
                "jcrPath": "/content/nuvox/us/en/products/airwave-pro/jcr:content/root/container/teaser",
                "currentContent": "Title: Special Offer\nDescription: We have a sale going on. Get discount on headphones. Limited time offer. Contact us for more details.\nCTA: Click Here",
            },
            {
                "id": "comp-6",
                "type": "text",
                "label": "Bottom CTA Section",
                "jcrPath": "/content/nuvox/us/en/products/airwave-pro/jcr:content/root/container/text_1",
                "currentContent": "If you have any questions about this product please contact us. Our team is available to help you. You can also check out our other products on the website. We have many different electronics and accessories available for purchase. Thank you for visiting our store.",
            },
        ],
    },
    "/content/nuvox/us/en/about-us": {
        "pageTitle": "About Us",
        "pagePath": "/content/nuvox/us/en/about-us",
        "components": [
            {
                "id": "comp-1",
                "type": "text",
                "label": "Hero Text",
                "jcrPath": "/content/nuvox/us/en/about-us/jcr:content/root/container/text",
                "currentContent": "NUVOX is a company that makes audio products. We are committed to providing best-in-class quality to our customers. Our team is experienced and works hard to deliver state-of-the-art solutions. Please contact us with any questions.",
            },
            {
                "id": "comp-2",
                "type": "text",
                "label": "Mission Statement",
                "jcrPath": "/content/nuvox/us/en/about-us/jcr:content/root/container/text_1",
                "currentContent": "Our mission is to provide customers with high quality audio products at competitive prices. We value customer satisfaction and care about the environment. Customers may provide feedback through our website.",
            },
        ],
    },
}

# Default fallback for any unrecognized path
DEFAULT_MOCK = {
    "pageTitle": "Sample Page",
    "pagePath": "",
    "components": [
        {
            "id": "comp-1",
            "type": "text",
            "label": "Text Component",
            "jcrPath": "",
            "currentContent": "Our wireless headphones are a premium quality product with revolutionary sound. They are available in several colors. Click here to learn more or contact us for details.",
        }
    ],
}
