# Connect Green Arena to Firebase Realtime Database

This adds cross-device live tournament updates. Hosts sign in anonymously in their browser; guests can read a shared tournament but cannot write to it. Firebase enforces the read/write rules on its servers.

## 1. Create a Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. In **Project settings → General**, add a **Web app** and copy its Firebase configuration.
3. In **Build → Realtime Database**, create a database. Choose a region near your users and start in **locked mode**.
4. Open the **Rules** tab, replace its contents with the contents of this repository's `database.rules.json`, and click **Publish**.
5. In **Build → Authentication → Sign-in method**, enable **Anonymous** sign-in.
6. In **Authentication → Settings → Authorized domains**, ensure `localhost` and your deployed site's hostname are listed.

The rules allow public reads of a tournament only when its unguessable ID is known. Writes require the same authenticated Firebase user that created the tournament. Do not replace these rules with public write access.

## 2. Add the Firebase web configuration

Open `firebase-config.js` and replace the example values with the values from the Web app configuration and Realtime Database:

- `apiKey`, `authDomain`, `projectId`, and `appId` come from **Project settings → General → Your apps**.
- `databaseURL` comes from **Realtime Database → Data**. Copy the full URL shown there; its hostname/region can vary.

Firebase web configuration is intended to be included in client apps. Do not put service-account keys, private keys, or Admin SDK credentials in this file.

## 3. Run the app from a web server

Do not open `index.html` as a `file://` URL. Use VS Code's Live Server extension or another local static HTTP server, then open the shown `http://localhost:...` address. For other users to reach guest links, deploy the whole project as a static site over HTTPS. Firebase Hosting, GitHub Pages, and other static hosts can serve the site; keep `firebase-config.js` alongside `index.html`.

## 4. Test live sharing

1. Start a tournament in the host browser. The status notice should report that live sharing is connected.
2. Use **Share** and copy the guest link. Configured links contain a tournament ID and do not embed a frozen score snapshot.
3. Open the link in a private window or another device. It should show the read-only tournament.
4. Record a score in the host window. The guest view should update automatically.
5. Try changing a score in the guest view; no editing controls should be present. The database rules also reject guest writes.

If Firebase is not configured, existing local tournament behavior continues and share links fall back to a read-only snapshot. The host's anonymous Firebase identity is stored by Firebase in that browser profile; clearing browser site data may prevent that profile from editing its existing cloud tournament.

## Free-plan notes

Firebase's no-cost Spark plan includes usage quotas for Realtime Database and Authentication. Quotas and product terms can change; check [Firebase pricing](https://firebase.google.com/pricing) before public launch. Monitor usage in the Firebase Console and avoid sharing personal or sensitive information in public tournament data.
