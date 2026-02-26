// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function () {


  // Hero Carousel
  const slides = document.querySelectorAll('.carousel-slide');
  const indicators = document.querySelectorAll('.indicator');
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  let currentSlide = 0;
  let carouselInterval;

  console.log('Carousel initialized - Slides:', slides.length, 'Indicators:', indicators.length);

  function showSlide(index) {
    slides.forEach(slide => slide.classList.remove('active'));
    indicators.forEach(indicator => indicator.classList.remove('active'));

    currentSlide = (index + slides.length) % slides.length;
    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
    console.log('Showing slide:', currentSlide);
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }

  function prevSlide() {
    showSlide(currentSlide - 1);
  }

  function startCarousel() {
    carouselInterval = setInterval(nextSlide, 5000);
  }

  function stopCarousel() {
    clearInterval(carouselInterval);
  }

  if (slides.length > 0) {
    // Initialize carousel
    showSlide(0);
    startCarousel();

    // Manual controls
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Next button clicked');
        nextSlide();
        stopCarousel();
        startCarousel();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Prev button clicked');
        prevSlide();
        stopCarousel();
        startCarousel();
      });
    }

    // Indicator clicks
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        console.log('Indicator clicked:', index);
        showSlide(index);
        stopCarousel();
        startCarousel();
      });
    });

    // Pause on hover
    const carouselContainer = document.querySelector('.carousel-container');
    if (carouselContainer) {
      carouselContainer.addEventListener('mouseenter', stopCarousel);
      carouselContainer.addEventListener('mouseleave', startCarousel);
    }
  } else {
    console.error('No carousel slides found!');
  }


  // Mobile Menu Toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');

      // Animate hamburger bars
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

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        const bars = menuToggle.querySelectorAll('.bar');
        bars[0].style.transform = 'none';
        bars[1].style.opacity = '1';
        bars[2].style.transform = 'none';
      });
    });
  }

  // Scroll Animation Observer
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Add animation classes to elements
  document.querySelectorAll('.service-card, .about-content, .contact-wrapper, .product-card, .plan-card, .gallery-item, .grid-item, .salon-card, .testimonial-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(el);
  });

  // Add CSS class for animation
  const style = document.createElement('style');
  style.textContent = `
  .animate-in {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
`;
  document.head.appendChild(style);

  // Membership Subscription Handlers
  const subscribeButtons = document.querySelectorAll('.btn-subscribe');

  subscribeButtons.forEach(button => {
    button.addEventListener('click', function () {
      const planCard = this.closest('.plan-card');
      const planName = planCard.querySelector('h3').textContent;
      const planPrice = planCard.querySelector('.plan-price').textContent;

      // You can replace this with actual payment/subscription logic
      console.log('Subscribe clicked for:', planName, planPrice);

      // Example: Show alert (replace with actual subscription flow)
      alert(`Thank you for choosing the ${planName} plan!\n\nYou'll be redirected to complete your subscription.`);

      // Redirect to contact page or payment gateway
      // window.location.href = 'contact.html';
      // Or integrate with payment service like Paystack
    });
  });

  // ========================================
  // GLOBAL ENHANCEMENTS
  // ========================================

  // Navbar Scroll Effect
  const navbar = document.querySelector('.navbar');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  });

  // Scroll to Top Button
  const scrollTopBtn = document.createElement('button');
  scrollTopBtn.classList.add('scroll-to-top');
  scrollTopBtn.innerHTML = '↑';
  scrollTopBtn.setAttribute('aria-label', 'Scroll to top');
  document.body.appendChild(scrollTopBtn);

  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }
  });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });



  // Lazy Load Images
  const lazyImages = document.querySelectorAll('img[loading="lazy"]');

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.classList.add('loaded');
        observer.unobserve(img);
      }
    });
  });

  lazyImages.forEach(img => {
    imageObserver.observe(img);
  });

  // External Links - Open in New Tab
  document.querySelectorAll('a[href^="http"]').forEach(link => {
    if (!link.href.includes(window.location.hostname)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });

  // Performance: Preload Critical Resources
  const preloadLink = document.createElement('link');
  preloadLink.rel = 'preconnect';
  preloadLink.href = 'https://fonts.googleapis.com';
  document.head.appendChild(preloadLink);

  // SEO: Add structured data (JSON-LD)
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FitnessCenter",
    "name": "Active Zone Hub",
    "description": "Premium fitness, beauty, and recreation facility in Lagos, Nigeria",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "29 Hainat Augusto Avenue, Oko-Oba Road",
      "addressLocality": "Orile-Agege",
      "addressRegion": "Lagos",
      "addressCountry": "Nigeria"
    },
    "telephone": ["+234-803-042-8467", "+234-906-767-1624"],
    "email": "support@activezone.ng",
    "openingHours": "Mo-Sa 06:00-22:00, Su 08:00-20:00",
    "priceRange": "₦₦₦"
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(structuredData);
  document.head.appendChild(script);

  console.log('✅ Global enhancements loaded successfully');
  console.log('- Sticky navbar with scroll effect');
  console.log('- Scroll to top button');
  console.log('- Dark mode toggle (optional)');
  console.log('- Lazy loading images');
  console.log('- SEO structured data');
  console.log('- Smooth scroll enabled');
  console.log('- Mobile-first responsive design');

  // Contact Form Handler
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Get form data
      const formData = new FormData(contactForm);
      const name = formData.get('name');
      const email = formData.get('email');
      const phone = formData.get('phone');
      const message = formData.get('message');
      
      // Get submit button
      const submitBtn = contactForm.querySelector('.btn-submit');
      const originalBtnText = submitBtn.textContent;
      
      // Show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      
      try {
        // Send to backend
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, email, phone, message })
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Show success message
          showContactFormMessage('success', result.message);
          
          // Reset form
          contactForm.reset();
        } else {
          // Show error message
          showContactFormMessage('error', result.error || 'Failed to send message');
        }
      } catch (error) {
        console.error('Contact form error:', error);
        showContactFormMessage('error', 'Network error. Please try again.');
      } finally {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
  }
  
  // Show message for contact form
  function showContactFormMessage(type, message) {
    // Remove existing messages
    const existingMessage = document.querySelector('.contact-form-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `contact-form-message ${type}`;
    messageEl.innerHTML = `
      <div style="
        padding: 15px;
        margin: 20px 0;
        border-radius: 8px;
        text-align: center;
        font-weight: 500;
        ${type === 'success' ? 
          'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : 
          'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'
        }
      ">
        ${message}
      </div>
    `;
    
    // Insert after form
    const contactFormWrapper = document.querySelector('.contact-form-wrapper');
    if (contactFormWrapper) {
      contactFormWrapper.insertBefore(messageEl, contactForm.nextSibling);
      
      // Auto remove after 5 seconds
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.remove();
        }
      }, 5000);
    }
  }

  // Membership Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const planContainers = document.querySelectorAll('.plans-container');

  if (tabBtns.length > 0) {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class from all buttons
        tabBtns.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');

        // Hide all plan containers
        planContainers.forEach(container => container.classList.remove('active'));

        // Show target container
        const tabId = btn.getAttribute('data-tab');
        const targetContainer = document.getElementById(`${tabId}-plans`);
        if (targetContainer) {
          targetContainer.classList.add('active');
        }
      });
    });
  }

}, false);

