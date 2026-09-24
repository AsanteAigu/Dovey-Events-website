<?php
if ($_SERVER['REQUEST_METHOD'] == 'GET' && !empty($_GET)) {
    // Collect form data
    $fname = htmlspecialchars($_GET['fname'] ?? '');
    $lname = htmlspecialchars($_GET['lname'] ?? '');
    $email = htmlspecialchars($_GET['email'] ?? '');
    $contact = htmlspecialchars($_GET['contact'] ?? '');
    $event_type = htmlspecialchars($_GET['event type'] ?? '');
    $guest_count = htmlspecialchars($_GET['guest count'] ?? '');
    $date = htmlspecialchars($_GET['date'] ?? '');

    // Prepare email content
    $to = 'aiguasante@gmail.com';
    $subject = 'New Form Submission from Dovey Events';
    $message = "New form submission received:\n\n" .
               "First Name: $fname\n" .
               "Last Name: $lname\n" .
               "Email: $email\n" .
               "Phone: $contact\n" .
               "Event Type: $event_type\n" .
               "Guest Count: $guest_count\n" .
               "Event Date: $date\n";
    $headers = 'From: no-reply@doveyevents.com' . "\r\n" .
               'Reply-To: ' . $email . "\r\n" .
               'X-Mailer: PHP/' . phpversion();

    // Send email
    if (mail($to, $subject, $message, $headers)) {
        echo "<h1>Thank you for your submission!</h1>";
        echo "<p>Your form has been sent successfully. We will contact you soon.</p>";
    } else {
        echo "<h1>Submission failed.</h1>";
        echo "<p>There was an error sending your form. Please try again.</p>";
    }
} else {
    echo "<h1>No data received.</h1>";
}
?>
