<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TypedNotification extends Notification
{
    use Queueable;

    private const SECURITY = ['password_changed', 'session_revoked', 'card_issued', 'card_cancelled', 'two_factor_enabled', 'two_factor_disabled'];
    private const ACTIVITY = ['transfer_received', 'bill_paid', 'card_purchase', 'low_balance'];

    public function __construct(public readonly string $type, public readonly array $params = []) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];
        $settings = $notifiable->settings;
        if (in_array($this->type, self::SECURITY, true) || (in_array($this->type, self::ACTIVITY, true) && ($settings?->email_activity ?? true))) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        return ['type' => $this->type, 'params' => $this->params];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $subject = match ($this->type) {
            'password_changed' => 'Your Westbridge password was changed',
            'session_revoked' => 'A Westbridge session was signed out',
            'card_issued' => 'A Westbridge virtual card was issued',
            'card_cancelled' => 'A Westbridge card was cancelled',
            'two_factor_enabled' => 'Two-factor sign-in was enabled',
            'two_factor_disabled' => 'Two-factor sign-in was disabled',
            default => 'Westbridge account activity',
        };

        return (new MailMessage)->subject($subject)
            ->greeting('Hello '.$notifiable->first_name.',')
            ->line('There is new activity on your Westbridge demo account.')
            ->line('Demo only. Westbridge National Bank is not a real bank. No real money is held.');
    }
}