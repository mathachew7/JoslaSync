# Multi-Tenant Invoicing System
---
## Project Overview

This project **JoslaSync** is a comprehensive multi-tenant invoicing system designed to empower small to medium-sized businesses with efficient client management, invoice creation, payment tracking, and reporting capabilities. Each company operates within its own secure, isolated environment, ensuring data privacy and integrity. The system aims to provide an intuitive, modern, and impactful tool for financial management.

---

## Features
The system provides the following core functionalities:

* **User & Company Registration:**
  * Seamless onboarding for new companies and their owners.
  * Secure user authentication.
* **Multi-Tenancy:**
  * Strict data isolation, ensuring each company only accesses its own data.
  * Utilizes `company_id` filtering on a shared Firestore database.
* **Client Management:**
  * Add, edit, and delete client profiles.
  * View client-specific history, including total invoiced and outstanding balances.
* **Invoice Management:**
  * Create new invoices with customizable line items.
  * Automatic and configurable invoice number generation.
  * Manage invoice statuses (Draft, Sent, Paid, Partial, Overdue, Cancelled).
  * View, edit (for drafts), and delete invoices.
* **Payment Tracking:**
  * Record payments received against invoices.
  * Automatic update of invoice statuses based on payments.
* **Reporting & Export:**
  * Export individual invoices as PDF or Excel (CSV).
  * Dashboard with key financial statistics (Total Invoiced, Paid, Outstanding).
  * Ability to filter reports by date range.

## Technical Stack

* **Frontend:** React.js
  * **Styling:** Tailwind CSS
  * **UI Components:** Shadcn/ui
  * **Icons:** Lucide-react
  * **Charts:** Recharts
* **Database:** Google Firestore
* **Authentication:** Firebase Authentication (leveraging `__initial_auth_token` for seamless integration within the Canvas environment).
* **Deployment (Conceptual):** Firebase Hosting

## Database Schema Overview (Firestore)

The application uses a shared collection model in Firestore, where each document includes a `companyId` field to maintain multi-tenancy.

* **`companies`**: Stores high-level information about each registered company.
  * `companyName`, `ownerId`, `ownerEmail`, `invoicePrefix`, `nextInvoiceNumber`
* **`users`**: Stores user accounts linked to their respective companies.
  * `companyId`, `email`, `passwordHash`, `name`, `role`
* **`clients`**: Stores client details for each company.
  * `companyId`, `name`, `contactPerson`, `email`, `phone`, `address`
* **`invoices`**: Stores invoice header information.
  * `companyId`, `clientId`, `invoiceNumber`, `invoiceDate`, `dueDate`, `status`, `totalAmount`, `amountPaid`, `outstandingBalance`
* **`invoice_items`**: Stores individual line items for each invoice.
  * `companyId`, `invoiceId`, `description`, `quantity`, `unitPrice`, `total`
* **`payments`**: Records payments received against invoices.
  * `companyId`, `invoiceId`, `amount`, `paymentDate`, `paymentMethod`, `notes`

*(Note: `createdAt` and `updatedAt` timestamps are implicitly included in all collections for tracking.)*

## Setup and Local Development

To set up and run this project, you will need Node.js and npm (or yarn) installed.

1. Clone the Repository (Conceptual)
` git clone <repository-url>
  cd multi-tenant-invoicing-system
`
2. Install Dependencies
Navigate to the project's root directory and install the necessary Node.js packages:
```
npm install
# or
yarn install
```
3. Firebase Configuration
This application is designed to run within an environment that provides Firebase configuration and authentication tokens. The following global variables are expected to be available:

* `__app_id`: The unique application ID.
* `__firebase_config`: A JSON string containing your Firebase project configuration.
* `__initial_auth_token`: A Firebase custom authentication token for initial user sign-in.

**Note:** In a typical local development setup outside of this specific environment, you would configure Firebase manually by creating a `firebaseConfig.js` file and initializing Firebase within your React app.

4. Running the Application
To start the development server:
```
npm start
# or
yarn start
```

This will typically open the application in your browser at `http://localhost:3000`.

---

## Security

* **Authentication:** JWTs are used for secure session management.
* **Authorization:** All data access is strictly controlled by `companyId` to ensure users only interact with their own company's data.
* **Data Validation:** Robust input validation is implemented to prevent malicious data and ensure data integrity.
* **HTTPS:** All communications are intended to be over HTTPS.
* **Error Handling:** Graceful error handling prevents exposure of sensitive system information.

## Future Enhancements

The following features are planned for future iterations:

* Support for multiple user roles (e.g., staff accounts with limited permissions).
* Recurring invoice functionality.
* Customizable invoice templates.
* Integration with popular payment gateways.
* Automated email notifications for invoices.
* Expense tracking and basic accounting features.
* Advanced reporting and analytics.
* Dedicated mobile application.

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License.
