<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordChangedNotification extends Notification
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your Westbridge password was changed')
            ->greeting('Hello '.$notifiable->first_name.',')
            ->line('The password for your Westbridge account was changed.')
            ->line('If this wasn\'t you, contact support immediately.');
    }
}
