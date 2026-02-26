-- MySQL Schema for Active Zone Hub (cPanel)
-- Import this file into your MySQL database via phpMyAdmin

CREATE TABLE IF NOT EXISTS `orders` (
  `id` varchar(50) NOT NULL,
  `customerName` varchar(255) NOT NULL,
  `customerEmail` varchar(255) NOT NULL,
  `customerPhone` varchar(50) NOT NULL,
  `deliveryMethod` varchar(20) NOT NULL,
  `deliveryAddress` text,
  `items` text NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `deliveryFee` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `notes` text,
  `status` varchar(50) DEFAULT 'pending',
  `paymentStatus` varchar(50) DEFAULT 'pending',
  `paymentReference` varchar(255) DEFAULT NULL,
  `gymMasterToken` varchar(255) DEFAULT NULL,
  `gymMasterMemberId` varchar(50) DEFAULT NULL,
  `paidAt` varchar(50) DEFAULT NULL,
  `statusUpdatedAt` varchar(50) DEFAULT NULL,
  `createdAt` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`customerEmail`),
  KEY `idx_reference` (`paymentReference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
