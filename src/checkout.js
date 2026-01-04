// checkout.js - Checkout Page Functionality with Gym Master Integration

document.addEventListener('DOMContentLoaded', function () {
    console.log('Checkout page loaded');
    
    var cart = new ShoppingCart();
    var DELIVERY_FEE = 2000;
    var API_BASE = 'http://localhost:3001/api';
    var deliveryMethod = 'pickup';
    var memberType = 'new';
    
    console.log('Cart items:', cart.items);
    
    // Check if cart is empty
    if (cart.items.length === 0) {
        document.getElementById('checkoutItems').innerHTML = '<p style="color: #ff6b6b; padding: 20px; text-align: center;">Your cart is empty. Please add items first.</p>';
    }
    
    // Initialize checkout page
    renderCheckoutItems();
    updateTotals();
    
    // Member type change handler
    var memberTypeRadios = document.querySelectorAll('input[name="memberType"]');
    memberTypeRadios.forEach(function(radio) {
        radio.addEventListener('change', function () {
            memberType = this.value;
            toggleMemberForms();
        });
    });
    
    function toggleMemberForms() {
        var newCustomerSection = document.getElementById('newCustomerSection');
        var existingMemberSection = document.getElementById('existingMemberSection');
        
        if (memberType === 'new') {
            newCustomerSection.style.display = 'block';
            existingMemberSection.style.display = 'none';
            
            // Set required fields
            document.getElementById('firstName').required = true;
            document.getElementById('lastName').required = true;
            document.getElementById('customerEmail').required = true;
            document.getElementById('customerPhone').required = true;
            document.getElementById('memberEmail').required = false;
            document.getElementById('memberPassword').required = false;
        } else {
            newCustomerSection.style.display = 'none';
            existingMemberSection.style.display = 'block';
            
            // Set required fields
            document.getElementById('firstName').required = false;
            document.getElementById('lastName').required = false;
            document.getElementById('customerEmail').required = false;
            document.getElementById('customerPhone').required = false;
            document.getElementById('memberEmail').required = true;
            document.getElementById('memberPassword').required = true;
        }
    }
    
    // Delivery method change handler
    var deliveryRadios = document.querySelectorAll('input[name="deliveryMethod"]');
    deliveryRadios.forEach(function(radio) {
        radio.addEventListener('change', function () {
            deliveryMethod = this.value;
            toggleDeliveryAddress();
            updateTotals();
        });
    });
    
    function toggleDeliveryAddress() {
        var deliveryAddressSection = document.getElementById('deliveryAddressSection');
        var addressInputs = deliveryAddressSection.querySelectorAll('input');
        
        if (deliveryMethod === 'delivery') {
            deliveryAddressSection.style.display = 'block';
            addressInputs.forEach(function(input) {
                if (input.id !== 'postalCode') {
                    input.required = true;
                }
            });
        } else {
            deliveryAddressSection.style.display = 'none';
            addressInputs.forEach(function(input) {
                input.required = false;
            });
        }
    }
    
    function renderCheckoutItems() {
        var checkoutItemsEl = document.getElementById('checkoutItems');
        
        if (!checkoutItemsEl) {
            console.error('checkoutItems element not found!');
            return;
        }
        
        if (cart.items.length === 0) {
            return;
        }
        
        checkoutItemsEl.innerHTML = '';
        
        cart.items.forEach(function(item) {
            var itemEl = document.createElement('div');
            itemEl.className = 'checkout-item';
            itemEl.innerHTML = 
                '<div class="checkout-item-image" style="background-image: url(\'' + item.image + '\')"></div>' +
                '<div class="checkout-item-details">' +
                    '<h4>' + item.name + '</h4>' +
                    '<p>Qty: ' + item.quantity + ' x NGN' + formatNumber(item.price) + '</p>' +
                '</div>' +
                '<div class="checkout-item-total">' +
                    'NGN' + formatNumber(item.price * item.quantity) +
                '</div>';
            checkoutItemsEl.appendChild(itemEl);
        });
    }
    
    function updateTotals() {
        var subtotal = 0;
        var itemCount = 0;
        
        cart.items.forEach(function(item) {
            subtotal += item.price * item.quantity;
            itemCount += item.quantity;
        });
        
        var deliveryFee = deliveryMethod === 'delivery' ? DELIVERY_FEE : 0;
        var total = subtotal + deliveryFee;
        
        document.getElementById('itemCount').textContent = itemCount;
        document.getElementById('subtotalAmount').textContent = formatNumber(subtotal);
        document.getElementById('deliveryFeeDisplay').textContent = deliveryFee > 0 ? 'NGN' + formatNumber(deliveryFee) : 'Free';
        document.getElementById('totalAmount').textContent = formatNumber(total);
    }
    
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    // Form submission handler
    var checkoutForm = document.getElementById('checkoutForm');
    var placeOrderBtn = document.getElementById('placeOrderBtn');
    
    checkoutForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        
        if (!checkoutForm.checkValidity()) {
            checkoutForm.reportValidity();
            return;
        }
        
        if (cart.items.length === 0) {
            alert('Your cart is empty. Please add items before checkout.');
            window.location.href = 'store.html';
            return;
        }
        
        // Validate stock availability before processing order
        placeOrderBtn.textContent = 'Checking stock...';
        
        try {
            var stockCheckResponse = await fetch(API_BASE + '/products/check-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart.items.map(function(item) {
                        return {
                            productId: item.productId,
                            quantity: item.quantity
                        };
                    })
                })
            });
            
            var stockResult = await stockCheckResponse.json();
            console.log('Stock check result:', stockResult);
            
            if (!stockResult.success) {
                // Show detailed stock errors
                var errorMessage = 'Stock Availability Issues:\n\n';
                
                if (stockResult.outOfStock && stockResult.outOfStock.length > 0) {
                    errorMessage += 'Out of Stock:\n';
                    stockResult.outOfStock.forEach(function(item) {
                        errorMessage += '- ' + item.name + '\n';
                        // Remove out of stock items from cart
                        var index = cart.items.findIndex(function(cartItem) {
                            return cartItem.productId === item.productId;
                        });
                        if (index !== -1) {
                            cart.items.splice(index, 1);
                        }
                    });
                    errorMessage += '\n';
                }
                
                if (stockResult.insufficient && stockResult.insufficient.length > 0) {
                    errorMessage += 'Insufficient Stock:\n';
                    stockResult.insufficient.forEach(function(item) {
                        errorMessage += '- ' + item.name + ' (Requested: ' + item.requested + ', Available: ' + item.available + ')\n';
                        // Auto-adjust quantity to available stock
                        var cartItem = cart.items.find(function(ci) {
                            return ci.productId === item.productId;
                        });
                        if (cartItem) {
                            cartItem.quantity = item.available;
                            cartItem.maxStock = item.available;
                        }
                    });
                }
                
                errorMessage += '\nYour cart has been updated. Please review and try again.';
                
                // Save updated cart
                cart.saveCart();
                
                // Reload page to show updated cart
                alert(errorMessage);
                location.reload();
                return;
            }
            
            console.log('Stock validation passed!');
            
        } catch (stockError) {
            console.error('Stock check error:', stockError);
            alert('Unable to verify stock availability. Please try again.');
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = 'Place Order';
            return;
        }
        
        placeOrderBtn.disabled = true;
        placeOrderBtn.textContent = 'Processing...';
        
        try {
            var token = null;
            var customerInfo = {};
            
            if (memberType === 'new') {
                // Create new prospect in Gym Master
                placeOrderBtn.textContent = 'Creating account...';
                
                var firstName = document.getElementById('firstName').value;
                var lastName = document.getElementById('lastName').value;
                var email = document.getElementById('customerEmail').value;
                var phone = document.getElementById('customerPhone').value;
                
                customerInfo = {
                    firstName: firstName,
                    lastName: lastName,
                    name: firstName + ' ' + lastName,
                    email: email,
                    phone: phone
                };
                
                // Prepare prospect data with address if delivery is selected
                var prospectData = {
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    phone: phone
                };
                
                // Add delivery address to prospect profile if delivery method is selected
                if (deliveryMethod === 'delivery') {
                    prospectData.address = {
                        street: document.getElementById('streetAddress').value,
                        city: document.getElementById('city').value,
                        state: document.getElementById('state').value,
                        postalCode: document.getElementById('postalCode').value
                    };
                }
                
                console.log('Creating prospect:', prospectData);
                
                var prospectResponse = await fetch(API_BASE + '/prospect/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(prospectData)
                });
                
                var prospectResult = await prospectResponse.json();
                console.log('Prospect result:', prospectResult);
                
                if (prospectResult.success) {
                    token = prospectResult.token;
                    customerInfo.prospectId = prospectResult.prospectId;
                    
                    // Update profile with phone and address if token was returned
                    if (token && (phone || (deliveryMethod === 'delivery'))) {
                        try {
                            console.log('Updating member profile with contact details...');
                            var profileUpdateResponse = await fetch(API_BASE + '/member/profile/update', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    token: token,
                                    phone: phone,
                                    address: deliveryMethod === 'delivery' ? prospectData.address : null
                                })
                            });
                            var profileResult = await profileUpdateResponse.json();
                            console.log('Profile update result:', profileResult);
                        } catch (profileError) {
                            console.log('Profile update failed:', profileError);
                            // Continue anyway - this is not critical
                        }
                    }
                } else {
                    // Continue without token - order will be logged
                    console.log('Prospect creation returned:', prospectResult.error);
                }
                
            } else {
                // Login existing member
                placeOrderBtn.textContent = 'Logging in...';
                
                var memberEmail = document.getElementById('memberEmail').value;
                var memberPassword = document.getElementById('memberPassword').value;
                
                var loginResponse = await fetch(API_BASE + '/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: memberEmail, password: memberPassword })
                });
                
                var loginResult = await loginResponse.json();
                console.log('Login result:', loginResult);
                
                if (loginResult.success) {
                    token = loginResult.token;
                    var sessionId = loginResult.sessionId;
                    var memberId = loginResult.memberId;
                    
                    customerInfo = {
                        name: loginResult.member?.name || memberEmail,
                        email: memberEmail,
                        memberId: memberId,
                        sessionId: sessionId
                    };
                    
                    console.log('Login successful, session ID:', sessionId);
                } else {
                    throw new Error(loginResult.error || 'Login failed. Please check your credentials.');
                }
            }
            
            // Calculate totals
            var subtotal = 0;
            cart.items.forEach(function(item) {
                subtotal += item.price * item.quantity;
            });
            var deliveryFee = deliveryMethod === 'delivery' ? DELIVERY_FEE : 0;
            var total = subtotal + deliveryFee;
            
            // Prepare order data
            var orderData = {
                token: token,
                customer: customerInfo,
                deliveryMethod: deliveryMethod,
                items: cart.items.map(function(item) {
                    return {
                        productId: parseInt(item.productId),  // Ensure productId is integer for Gym Master API
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity
                    };
                }),
                subtotal: subtotal,
                deliveryFee: deliveryFee,
                total: total,
                notes: document.getElementById('orderNotes').value
            };
            
            if (deliveryMethod === 'delivery') {
                orderData.deliveryAddress = {
                    street: document.getElementById('streetAddress').value,
                    city: document.getElementById('city').value,
                    state: document.getElementById('state').value,
                    postalCode: document.getElementById('postalCode').value
                };
            }
            
            console.log('Submitting order:', orderData);
            placeOrderBtn.textContent = 'Placing order...';
            
            var orderResult;
            
            // Process order and initiate payment
            placeOrderBtn.textContent = 'Placing order...';
            
            var orderResponse = await fetch(API_BASE + '/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            
            orderResult = await orderResponse.json();
            
            if (orderResult.success) {
                console.log('Order successful:', orderResult);
                
                // Clear cart
                localStorage.removeItem('activeZoneCart');
                
                // Redirect to payment or home
                if (orderResult.paymentUrl) {
                    console.log('Redirecting to payment:', orderResult.paymentUrl);
                    window.location.href = orderResult.paymentUrl;
                } else {
                    // Show success message for test mode
                    alert('Order Placed Successfully!\n\nOrder ID: ' + orderResult.orderId + '\nCustomer: ' + customerInfo.name + '\nTotal: NGN' + total.toLocaleString());
                    window.location.href = 'index.html';
                }
            } else {
                throw new Error(orderResult.error || 'Order failed');
            }
            
        } catch (error) {
            console.error('Order error:', error);
            
            // If backend is not available, fall back to local logging
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                alert('Order could not be processed.\n\nPlease make sure the backend server is running:\nnpm run server');
            } else {
                alert('Failed to place order: ' + error.message);
            }
            
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = 'Place Order';
        }
    });
});
