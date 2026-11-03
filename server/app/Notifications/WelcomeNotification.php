<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WelcomeNotification extends Notification
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Welcome to Westbridge National Bank')
            ->greeting('Welcome, '.$notifiable->first_name.'!')
            ->line('Your email is verified and your Westbridge demo account is ready.')
            ->line('This is a demo project. No real money is held.');
    }
}
