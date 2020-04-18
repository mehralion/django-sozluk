﻿## django-sozluk, ekşi sözlük clone powered by Python
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/6c2a34dfbd184f139cd32f8f622d4002)](https://www.codacy.com/manual/realsuayip/django-sozluk?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=realsuayip/django-sozluk&amp;utm_campaign=Badge_Grade)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

Check [CHANGELOG](CHANGELOG) before cloning a newer version!

This project is subject to further development, check out "todo" keyword in the project files or github issues to see the to-do's.

Check out [screenshots](screenshots) folder to see current front-end in action with both the desktop and mobile views.
   
No extra actions needed other than migrations and creation of admin account (make sure to remove the account from "çaylak listesi" so as to have the entries published). Check out djangoproject.com to see how to handle deployment procedures if you already don't know. Make sure to have your local email server set up with this command, if needed (if the port 1025 is already in use, change it also in the settings):

    python -m smtpd -n -c DebuggingServer localhost:1025

Python 3.7.6+ required. Other dependencies are stated in requirements file.

 If you want to contribute to the project or have found a bug or need help about deployment etc., you may contact me via Telegram (I use the same username there) or create an issue.