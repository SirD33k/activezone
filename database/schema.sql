-- MySQL Schema for Active Zone Hub
-- Import this file into your MySQL database via phpMyAdmin

CREATE TABLE IF NOT EXISTS `orders` (
  `id` varchar(50) NOT NULL,
  `orderId` varchar(50) NOT NULL,
  `customer` JSON NOT NULL,
  `items` JSON NOT NULL,
  `deliveryMethod` varchar(20) NOT NULL DEFAULT 'pickup',
  `deliveryAddress` JSON,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0,
  `deliveryFee` decimal(10,2) NOT NULL DEFAULT 0,
  `total` decimal(10,2) NOT NULL,
  `notes` text,
  `paymentStatus` varchar(20) DEFAULT 'pending',
  `deliveryStatus` varchar(20) DEFAULT 'pending',
  `paymentReference` varchar(255) DEFAULT NULL,
  `gymMasterToken` varchar(255) DEFAULT NULL,
  `gymMasterMemberId` varchar(50) DEFAULT NULL,
  `paidAt` varchar(50) DEFAULT NULL,
  `statusUpdatedAt` varchar(50) DEFAULT NULL,
  `timestamp` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_orderId` (`orderId`),
  KEY `idx_email` ((JSON_EXTRACT(customer, '$.email'))),
  KEY `idx_paymentReference` (`paymentReference`),
  KEY `idx_deliveryStatus` (`deliveryStatus`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products table for inventory management
CREATE TABLE IF NOT EXISTS `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `productid` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `producttype` varchar(50) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `description` text,
  `maxquantity` int(11) DEFAULT 0,
  `visible` tinyint(1) DEFAULT 1,
  `createdAt` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_productid` (`productid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
