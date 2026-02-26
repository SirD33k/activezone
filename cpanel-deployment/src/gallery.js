// Gallery.js - Gallery filtering and lightbox functionality

document.addEventListener('DOMContentLoaded', function () {
    console.log('=== GALLERY SCRIPT LOADED ===')
    
    // Gallery Filtering
    const filterButtons = document.querySelectorAll('.gallery-filter-btn');
    const masonryItems = document.querySelectorAll('.masonry-item');

    console.log('Filter buttons found:', filterButtons.length);
    console.log('Masonry items found:', masonryItems.length);

    // Add click event listeners to filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault(); // Prevent any default behavior
            
            const selectedFilter = this.getAttribute('data-filter');
            console.log('===== FILTER CLICKED: ' + selectedFilter + ' =====' );
            console.log('Button element:', this);
            console.log('Button classes before:', this.className);
            
            // Remove active class from all buttons
            filterButtons.forEach(btn => {
                btn.classList.remove('active');
                console.log('Removed active from:', btn.getAttribute('data-filter'));
            });
            
            // Add active class to clicked button
            this.classList.add('active');
            console.log('Button classes after:', this.className);
            console.log('Has active class?', this.classList.contains('active'));
            console.log('Button "' + selectedFilter + '" is now active');
            
            // Force a visual check
            const computedStyle = window.getComputedStyle(this);
            console.log('Computed background:', computedStyle.backgroundColor);
            console.log('Computed color:', computedStyle.color);
            
            let visibleItemsCount = 0;
            
            // Show/hide items based on filter
            masonryItems.forEach(item => {
                const itemCategory = item.getAttribute('data-category');
                
                if (selectedFilter === 'all' || itemCategory === selectedFilter) {
                    item.classList.remove('hidden');
                    visibleItemsCount++;
                    console.log('  ✓ Showing: ' + itemCategory);
                } else {
                    item.classList.add('hidden');
                    console.log('  ✗ Hiding: ' + itemCategory);
                }
            });
            
            console.log('Total visible items: ' + visibleItemsCount);
            console.log('=====================================');
        });
    });

    // Lightbox Functionality
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxCategory = document.getElementById('lightboxCategory');
    const closeBtn = document.querySelector('.lightbox-close');
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');

    // Check if lightbox elements exist before adding event listeners
    if (!lightbox || !lightboxImage || !closeBtn || !prevBtn || !nextBtn) {
        console.error('Lightbox elements not found!');
        return;
    }

    let currentIndex = 0;
    let visibleItems = [];

    // Get all visible items for navigation
    function updateVisibleItems() {
        visibleItems = Array.from(masonryItems).filter(item => !item.classList.contains('hidden'));
    }

    // Open lightbox
    masonryItems.forEach((item, index) => {
        item.addEventListener('click', function () {
            updateVisibleItems();
            const img = this.querySelector('img');
            const title = this.querySelector('.masonry-overlay h3').textContent;
            const category = this.querySelector('.masonry-overlay p').textContent;

            currentIndex = visibleItems.indexOf(this);

            lightboxImage.src = img.src;
            lightboxImage.alt = img.alt;
            lightboxTitle.textContent = title;
            lightboxCategory.textContent = category;

            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling

            console.log('Lightbox opened:', title);
        });
    });

    // Close lightbox
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
        console.log('Lightbox closed');
    }

    closeBtn.addEventListener('click', closeLightbox);

    // Close on background click
    lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });

    // Previous image
    prevBtn.addEventListener('click', function () {
        currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
        showImage(currentIndex);
    });

    // Next image
    nextBtn.addEventListener('click', function () {
        currentIndex = (currentIndex + 1) % visibleItems.length;
        showImage(currentIndex);
    });

    // Arrow key navigation
    document.addEventListener('keydown', function (e) {
        if (!lightbox.classList.contains('active')) return;

        if (e.key === 'ArrowLeft') {
            currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
            showImage(currentIndex);
        } else if (e.key === 'ArrowRight') {
            currentIndex = (currentIndex + 1) % visibleItems.length;
            showImage(currentIndex);
        }
    });

    // Show image at index
    function showImage(index) {
        const item = visibleItems[index];
        const img = item.querySelector('img');
        const title = item.querySelector('.masonry-overlay h3').textContent;
        const category = item.querySelector('.masonry-overlay p').textContent;

        lightboxImage.src = img.src;
        lightboxImage.alt = img.alt;
        lightboxTitle.textContent = title;
        lightboxCategory.textContent = category;

        console.log('Showing image:', title);
    }
});
