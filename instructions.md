# AI Website Development Challenge: Crumb & Co.

## Objective

Create a visually stunning, modern, professional website for a fictional gourmet cookie and dessert shop called **Crumb & Co.**

The website should look like something a real premium dessert brand would use to attract customers, showcase products, and sell cookies online.

This challenge is designed to evaluate your ability to independently design and develop a beautiful, interactive, fully functional website.

**Your goal is to create the most visually impressive, creative, and polished website possible while meeting all technical and functional requirements.**

Make your own creative and technical decisions. Do not ask clarifying questions.

---

# 1\. Technical Requirements

Build the website using only:

- HTML5
- CSS3
- Vanilla JavaScript
- Native browser APIs, including WebGL if needed

### Restrictions

- No React, Vue, Angular, or other frontend frameworks.
- No TypeScript.
- No Three.js or other external 3D libraries.
- No Bootstrap, Tailwind, or external CSS frameworks.
- No jQuery or external JavaScript libraries.
- No npm, Node.js, or package managers.
- No build tools or compilation.
- No local web server.
- No external runtime dependencies.

### Local Execution

**The website must work by simply double\-clicking** **index.html****.**

The user should not need to install anything, execute commands, or configure a development environment.

The website must work offline after downloading and extracting the project.

Use relative paths for all assets.

### Project Structure

Organize the project as follows:

- index.html: Main website
- style.css: All website styling
- script.js: All interactive functionality
- assets/: Images, textures, and other required assets

You may add additional local files if necessary.

---

# 2\. Brand Identity

**Business Name:** Crumb & Co.

**Business Type:** Premium gourmet cookie and dessert shop.

### Brand Personality

The brand should feel:

- Modern
- Playful
- Warm and inviting
- Premium but approachable
- Creative
- Memorable

### Target Audience

Customers who enjoy gourmet cookies, premium desserts, gifting, and unique bakery experiences.

### Creative Freedom

You have complete creative freedom over:

- Color palette
- Typography
- Layout
- Visual hierarchy
- Animations
- Illustrations
- Product presentation
- Overall design aesthetic

The website should feel custom\-designed rather than assembled from a generic template.

**Do not sacrifice creativity for simplicity.**

---

# 3\. Interactive 3D Cookie Experience

## Primary Visual Feature

Create an impressive, interactive **3D chocolate chip cookie** that serves as the centerpiece of the website's hero section.

This is one of the most important requirements of the challenge.

The cookie should immediately capture attention and demonstrate advanced frontend development capabilities.

### 3D Appearance

The cookie should have:

- A convincing three\-dimensional shape
- Realistic thickness
- Naturally rounded, slightly irregular edges
- A textured baked surface
- Visible chocolate chips embedded in the cookie
- Natural color variation
- Realistic lighting and shadows
- Depth and dimensionality

The cookie should look appetizing, premium, and visually polished.

Avoid making it look like a flat circle or a simple geometric disc.

### Animation

Implement smooth animations such as:

- Gentle automatic rotation
- Subtle floating or hovering
- Smooth transitions
- Realistic movement
- Optional lighting or shadow effects

Animations should enhance the experience without becoming distracting.

### User Interaction

Users must be able to:

1. Click and drag the cookie to rotate it.
2. Rotate it horizontally and vertically.
3. Interact using mouse or touch controls.
4. Release the cookie and experience a smooth transition back to its idle animation.

Bonus features could include:

- Rotation inertia
- Interactive lighting
- Cursor\-responsive movement
- Smooth zooming
- Subtle physics\-inspired animations

### Technical Implementation

You may use:

- Native WebGL
- CSS 3D transforms
- Custom JavaScript 3D rendering
- Procedural geometry
- Canvas APIs
- Other native browser capabilities

**Do not use Three.js or external 3D libraries.**

The implementation must work directly from the local filesystem without a server.

### Quality Expectations

The 3D cookie must:

- Look genuinely three\-dimensional.
- Support interactive rotation.
- Render smoothly.
- Work on desktop and mobile.
- Integrate naturally into the website design.
- Avoid excessive CPU or GPU usage.

**Important:** A flat cookie image with a basic rotation animation does not satisfy this requirement.

The 3D cookie should be one of the most visually impressive elements on the page.

---

# 4\. Website Sections

## Navigation

Create a modern, responsive navigation bar.

Include:

- Crumb & Co. logo
- Home
- Our Cookies
- About Us
- Reviews
- Contact
- Shopping cart icon with item count

Requirements:

- Responsive mobile navigation
- Smooth scrolling
- Hover effects
- Clear active states
- Functional navigation links

You may use a sticky navigation bar if it improves the design.

## Hero Section

Create a visually stunning hero section featuring the interactive 3D cookie.

Include:

- Compelling headline
- Short marketing description
- Prominent call\-to\-action button
- Interactive 3D cookie
- Creative layout and typography
- Attractive background design

The hero should immediately communicate the brand's premium, playful personality.

Use the 3D cookie as a major visual attraction rather than a small decorative element.

## Featured Cookies

Display at least six gourmet cookie products.

Each product must include:

- High\-quality product image
- Creative product name
- Short description
- Price
- Add to Cart button

Invent realistic cookie varieties and prices.

Examples include:

- Classic Chocolate Chunk
- Brown Butter Sea Salt
- Cookies & Cream
- Red Velvet Dream
- Peanut Butter Explosion
- Triple Chocolate Fudge

You may invent your own product lineup.

### Product Card Design

Product cards should feature:

- Beautiful imagery
- Consistent spacing
- Attractive typography
- Hover animations
- Interactive buttons
- Clear pricing

The product section should look like a premium online bakery storefront.

## About the Bakery

Create a visually engaging section explaining the story behind Crumb & Co.

Include:

- A short, compelling brand story
- What makes the cookies special
- Quality ingredients
- Fresh baking
- Supporting imagery or illustrations

Avoid generic corporate language.

Make the brand feel authentic and memorable.

## Customer Reviews

Include at least three fictional customer testimonials.

Each testimonial should feature:

- Customer name
- Star rating
- Short review
- Attractive visual presentation

Reviews should feel natural and believable.

## Contact and Footer

Include:

- Contact information
- Business hours
- Social media links
- Newsletter signup
- Copyright information

Use fictional business information and clearly label demonstrations where appropriate.

---

# 5\. Shopping Cart Functionality

Implement a fully functional frontend shopping cart using vanilla JavaScript.

### Required Features

Users must be able to:

1. Add cookies to the cart.
2. See the cart item count update.
3. Open and close the shopping cart.
4. View products in the cart.
5. Increase product quantities.
6. Decrease product quantities.
7. Remove products.
8. View the calculated subtotal.
9. Proceed to a simulated checkout.

### Cart Persistence

Use localStorage to preserve shopping cart contents when the page is refreshed or reopened.

### Checkout

Create a polished demonstration checkout experience.

The checkout should:

- Display the order summary.
- Show the total.
- Allow the user to simulate placing an order.
- Display an order confirmation.

No real payments or backend services are required.

Clearly indicate that checkout is a demonstration.

---

# 6\. Additional Interactive Features

Include thoughtful interactions throughout the website.

Examples:

- Smooth scrolling
- Scroll\-triggered animations
- Button hover effects
- Product card animations
- Interactive navigation
- Animated cart drawer
- Add\-to\-cart confirmations
- Newsletter form validation
- Subtle background movement
- Animated section transitions

All visible interactive elements should function correctly.

Avoid decorative buttons that do nothing.

Animations should feel smooth and intentional rather than excessive.

---

# 7\. Images and Visual Assets

Use beautiful, high\-quality cookie and dessert imagery.

You may:

- Generate original images if image\-generation capabilities are available.
- Use suitable openly licensed images.
- Create custom illustrations or textures.

### Requirements

- All required assets must be included locally.
- Do not rely on remote image URLs.
- Do not rely on CDNs.
- Do not use broken image links.
- Do not use generic placeholders.
- Optimize images for reasonable loading performance.

The website must remain visually complete without an internet connection.

For the 3D cookie, procedural textures and geometry are acceptable.

---

# 8\. Responsive Design

The website must work beautifully across:

### Desktop

- Large monitors
- Standard laptop screens

### Tablet

- Landscape orientation
- Portrait orientation

### Mobile

- Modern smartphones
- Small screens
- Touch interaction

Ensure:

- Responsive typography
- Appropriate spacing
- No horizontal overflow
- Functional mobile navigation
- Responsive product grids
- Usable shopping cart
- Properly scaled 3D cookie

The mobile experience should feel intentionally designed rather than simply compressed.

---

# 9\. Accessibility and Performance

Follow modern frontend development best practices.

### Accessibility

- Semantic HTML
- Meaningful image alt text
- Keyboard\-accessible navigation
- Visible focus indicators
- Adequate color contrast
- Accessible form labels
- Reduced\-motion support

### Performance

- Efficient JavaScript
- Optimized images
- Smooth animations
- Efficient 3D rendering
- Avoid unnecessary DOM updates
- Avoid excessive CPU/GPU utilization

The 3D experience should not make the rest of the website sluggish.

---

# 10\. Visual Design Expectations

This is primarily a **creative frontend design and development challenge**.

Prioritize the following:

1. Exceptional visual design
2. Impressive interactive 3D cookie
3. Professional typography
4. Beautiful product imagery
5. Creative layout
6. Thoughtful color combinations
7. Smooth animations
8. Functional interactions
9. Responsive design
10. Attention to detail

### Avoid

- Generic website templates
- Poor\-quality graphics
- Flat or unconvincing 3D effects
- Excessive whitespace
- Inconsistent spacing
- Overly complicated navigation
- Unnecessary dependencies
- Broken mobile layouts
- Placeholder content
- Nonfunctional buttons

The final website should feel like a real premium dessert brand with a professionally designed online storefront.

---

# 11\. Deliverables

Provide a complete, downloadable ZIP file containing the entire website.

The ZIP should include:

- index.html
- style.css
- script.js
- assets/ directory with all necessary images and textures
- Any additional local files required

### User Experience

The user should be able to:

1. Download the ZIP file.
2. Extract it into a folder.
3. Double\-click index.html.
4. Immediately view the complete website.
5. Interact with the 3D cookie.
6. Browse products.
7. Add cookies to the shopping cart.
8. Complete a simulated checkout.

**No installation, configuration, internet connection, or server should be required.**

---

# 12\. Final Verification

Before delivering the project, verify that:

- All required files are present.
- index.html opens directly in a browser.
- All images and assets load.
- The 3D cookie renders correctly.
- The 3D cookie rotates automatically.
- Mouse dragging rotates the cookie.
- Touch interaction works.
- Navigation links work.
- Mobile navigation works.
- Products can be added to the cart.
- Cart quantities can be adjusted.
- Cart totals calculate correctly.
- Cart contents persist after refresh.
- Simulated checkout works.
- Forms validate correctly.
- Responsive layouts work.
- There are no obvious JavaScript errors.
- No internet connection is required.

If browser\-based verification is available, test the website before delivering it.

---

# 13\. Final Instructions

You are acting as both a **senior frontend developer and an award\-winning web designer**.

Your responsibility is to create the entire website, not merely describe how it could be built.

Make independent decisions about design, layout, animations, and implementation.

Do not ask clarifying questions.

Do not deliver incomplete code, mockups, or placeholder files.

Deliver a complete, working website packaged as a downloadable ZIP.

### Creative Challenge

Push the boundaries of what is possible using only HTML, CSS, vanilla JavaScript, and native browser APIs.

The website should be:

- Visually stunning
- Technically impressive
- Highly interactive
- Creative and distinctive
- Professional
- Fully functional
- Easy to run locally

**Treat this as a portfolio\-quality project that demonstrates your absolute best frontend development, visual design, and interactive 3D capabilities.**

The finished result should make someone say, **"I can't believe this was built with just HTML, CSS, and JavaScript."**

