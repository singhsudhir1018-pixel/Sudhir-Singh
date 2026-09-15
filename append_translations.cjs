const fs = require('fs');
let content = fs.readFileSync('src/lib/translations.ts', 'utf8');

const englishAdditions = `
    // User Management Keys
    userManagement: 'User Management',
    addUser: 'Add User',
    fullName: 'Full Name',
    mobileNumber: 'Mobile Number',
    emailAddress: 'Email Address (Login ID)',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    address: 'Residential / Contact Address',
    roleLabel: 'Assigned User Role',
    admin: 'Admin (Full Access)',
    manager: 'Manager (Operations & Staff)',
    accountant: 'Accountant (Finance & Reports)',
    worker: 'Worker / Staff (Tasks & Attendance)',
    accountStatus: 'Account Status',
    activeUser: 'Active',
    inactiveUser: 'Inactive',
    status: 'Status',
    searchUsers: 'Search users...',
    allRoles: 'All Roles',
    allStatuses: 'All Statuses',
    editUser: 'Edit User',
    deleteUser: 'Delete User',
    resetPassword: 'Reset Password',
    noUsers: 'No users found.',
    passwordMismatch: 'Passwords do not match.',
    userCreated: 'User created successfully.',
    userUpdated: 'User updated successfully.',
    userDeleted: 'User deleted successfully.',
    deleteUserConfirm: 'Are you sure you want to delete this user? This action cannot be undone.',
    resetPasswordConfirm: 'Send a password reset link to this user\\'s email?',
    adminRole: 'Admin',
    managerRole: 'Manager',
    accountantRole: 'Accountant',
    workerRole: 'Worker',
    saveChanges: 'Save Changes',
`;

const nepaliAdditions = `
    // User Management Keys
    userManagement: 'प्रयोगकर्ता व्यवस्थापन',
    addUser: 'नयाँ प्रयोगकर्ता थप्नुहोस्',
    fullName: 'पूरा नाम',
    mobileNumber: 'मोबाइल नम्बर',
    emailAddress: 'इमेल ठेगाना (लगइन आइडी)',
    password: 'पासवर्ड',
    confirmPassword: 'पासवर्ड पुष्टि गर्नुहोस्',
    address: 'ठेगाना',
    roleLabel: 'भूमिका / पद तोक्नुहोस्',
    admin: 'मालिक/प्रशासक (पूर्ण पहुँच)',
    manager: 'प्रबन्धक (सञ्चालन र कर्मचारी)',
    accountant: 'लेखापाल (वित्तीय र रिपोर्ट)',
    worker: 'कर्मचारी / मजदुर (कार्य र हाजिरी)',
    accountStatus: 'खाता स्थिति',
    activeUser: 'सक्रिय',
    inactiveUser: 'निष्क्रिय',
    status: 'स्थिति',
    searchUsers: 'प्रयोगकर्ता खोज्नुहोस्...',
    allRoles: 'सबै भूमिकाहरू',
    allStatuses: 'सबै स्थितिहरू',
    editUser: 'प्रयोगकर्ता सम्पादन',
    deleteUser: 'प्रयोगकर्ता मेटाउनुहोस्',
    resetPassword: 'पासवर्ड रिसेट गर्नुहोस्',
    noUsers: 'कुनै प्रयोगकर्ता फेला परेन।',
    passwordMismatch: 'पासवर्ड मिलेन।',
    userCreated: 'प्रयोगकर्ता सफलतापूर्वक सिर्जना गरियो।',
    userUpdated: 'प्रयोगकर्ता विवरण अद्यावधिक गरियो।',
    userDeleted: 'प्रयोगकर्ता सफलतापूर्वक मेटाइयो।',
    deleteUserConfirm: 'के तपाईं पक्का यो प्रयोगकर्ता मेटाउन चाहनुहुन्छ? यो कार्य फिर्ता गर्न सकिँदैन।',
    resetPasswordConfirm: 'यो प्रयोगकर्ताको इमेलमा पासवर्ड रिसेट लिङ्क पठाउनुहोस्?',
    adminRole: 'प्रशासक',
    managerRole: 'प्रबन्धक',
    accountantRole: 'लेखापाल',
    workerRole: 'कर्मचारी',
    saveChanges: 'परिवर्तनहरू सुरक्षित गर्नुहोस्',
`;

// Insert after `feeding: 'Feeding',` and similar spots, or just before the closing bracket of en and ne.

let enRegex = /(en:\s*\{[\s\S]*?)(\s*\})/m;
let neRegex = /(ne:\s*\{[\s\S]*?)(\s*\})/m;

content = content.replace(enRegex, (match, p1, p2) => p1 + englishAdditions + p2);
content = content.replace(neRegex, (match, p1, p2) => p1 + nepaliAdditions + p2);

fs.writeFileSync('src/lib/translations.ts', content);
console.log('Translations updated.');
