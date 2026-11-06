<?php

namespace App\Notifications;

class WelcomeNotification extends TypedNotification
{
    public function __construct()
    {
        parent::__construct('welcome');
    }
}
