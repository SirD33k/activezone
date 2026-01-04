export function injectLayout() {
  const app = document.getElementById('app');
  if (!app) return;

  // Create Navbar
  const navbar = document.createElement('nav');
  navbar.className = 'navbar';
  navbar.innerHTML = `
    <div class="container">
      <a href="index.html" class="logo">Active Zone Hub</a>
      <button class="menu-toggle" aria-label="Toggle navigation">
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
      </button>
      <ul class="nav-links">
        <li><a href="index.html">Home</a></li>
        <li><a href="about.html">About</a></li>
        <li><a href="services.html">Services</a></li>
        <li><a href="store.html">RDX Store</a></li>
        <li><a href="membership.html">Membership</a></li>
        <li><a href="gallery.html">Gallery</a></li>
        <li><a href="contact.html">Contact</a></li>
        <li><a href="membership.html" class="btn-primary">Join Now</a></li>
      </ul>
    </div>
  `;

  // Create Footer
  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="container">
      <div class="footer-content">
        <div class="footer-brand">
          <h3>Active Zone Hub</h3>
          <p>Elevating lifestyles through fitness, beauty, and recreation.</p>
        </div>
        <div class="footer-links">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="about.html">About Us</a></li>
            <li><a href="services.html">Services</a></li>
            <li><a href="store.html">Store</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </div>
        <div class="footer-contact">
          <h4>Contact Us</h4>
          <p>Lagos, Nigeria</p>
          <p>info@activezonehub.com</p>
          <p>+234 123 456 7890</p>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2024 Active Zone Hub. All rights reserved.</p>
      </div>
    </div>
  `;

  // Insert Navbar at the beginning
  app.insertBefore(navbar, app.firstChild);

  // Append Footer at the end
  app.appendChild(footer);

  // Re-initialize menu toggle logic
  initMenuToggle();
}

function initMenuToggle() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (menuToggle && navLinks) {
    // Remove old event listeners if any (simple way is to clone and replace, but here we just add new ones assuming fresh inject)
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');

      const bars = menuToggle.querySelectorAll('.bar');
      if (navLinks.classList.contains('active')) {
        bars[0].style.transform = 'rotate(-45deg) translate(-5px, 6px)';
        bars[1].style.opacity = '0';
        bars[2].style.transform = 'rotate(45deg) translate(-5px, -6px)';
      } else {
        bars[0].style.transform = 'none';
        bars[1].style.opacity = '1';
        bars[2].style.transform = 'none';
      }
    });
  }
}
