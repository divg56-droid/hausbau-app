<?php
/**
 * Vorlage. Kopie als geheim.php anlegen und ausfuellen.
 *
 * geheim.php steht in .gitignore und wird nie hochgeladen ausser mit
 * deploy.py --geheim. Auf dem Server liegt sie in einem Verzeichnis, das
 * per .htaccess gesperrt ist.
 */
return [
    // Zugangsdaten der MariaDB aus KAS
    'db_host' => 'localhost',
    // Nur setzen, wenn der Server nicht auf 3306 hoert.
    'db_port' => null,
    'db_name' => '',
    'db_nutzer' => '',
    'db_passwort' => '',

    // Woher darf die App zugreifen? Die Weboberflaeche liegt auf derselben
    // Domain und braucht keinen Eintrag; die Android-App meldet sich mit
    // https://localhost, weil Capacitor sie so ausliefert.
    'erlaubte_herkunft' => ['https://localhost', 'capacitor://localhost'],

    // Absender fuer Bestaetigungs- und Passwortmails
    'absender' => 'kontakt@bauzeuge.de',

    // Schuetzt einrichten.php. Selbst ausdenken, lang und zufaellig.
    // Ohne diesen Wert laesst sich das Schema nicht anlegen.
    'einrichten_schluessel' => '',
];
