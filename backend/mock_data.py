# Intentionally corporate and bland ("good quality", "click here", "contact us") so the
# NUVOX brand refresh from Gemini is an instant, visible contrast.
MOCK_PAGES = {
    "/content/nuvox/us/en/products/aura-headphones": {
        "pageTitle": "Aura Wireless Headphones",
        "pagePath": "/content/nuvox/us/en/products/aura-headphones",
        "components": [
            {
                "id": "comp-1",
                "type": "text",
                "label": "Text Component",
                "jcrPath": "/content/nuvox/us/en/products/aura-headphones/jcr:content/root/container/text",
                "currentContent": "The Aura Wireless Headphones are a good quality audio product for everyday use. They offer enhanced bass response and a comfortable fit. The company has been making audio devices for many years and customers are satisfied with the performance. Contact us for more information.",
            },
            {
                "id": "comp-2",
                "type": "accordion",
                "label": "Accordion Component",
                "jcrPath": "/content/nuvox/us/en/products/aura-headphones/jcr:content/root/container/accordion",
                "currentContent": "Item 1: Product features\nThe headphones have Bluetooth connectivity, noise cancellation and a long battery life. They are available in several colors.\n\nItem 2: Materials and packaging\nThe product is made with recycled materials. The packaging does not contain plastic. Shipping is carbon offset.\n\nItem 3: Warranty and support\nThe product comes with a one year warranty. Customers can submit a support ticket or send an email to the support team.",
            },
            {
                "id": "comp-3",
                "type": "teaser",
                "label": "Teaser Component",
                "jcrPath": "/content/nuvox/us/en/products/aura-headphones/jcr:content/root/container/teaser",
                "currentContent": "Title: New Headphones Available\nDescription: The company has released a new pair of wireless headphones with good sound quality. Available in six colors.\nCTA: Click here",
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
