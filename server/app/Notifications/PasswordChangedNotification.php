<?php

namespace App\Notifications;

class PasswordChangedNotification extends TypedNotification
{
    public function __construct()
    {
        parent::__construct('password_changed');
    }
}
