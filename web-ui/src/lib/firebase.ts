// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAqNxAFAPKZFr3X5nwBS_AuGMVzVKv9ghU",
    authDomain: "narrativereactor.firebaseapp.com",
    projectId: "narrativereactor",
    storageBucket: "narrativereactor.firebasestorage.app",
    messagingSenderId: "181727405764",
    appId: "1:181727405764:web:e7395d51afd2572e654b91",
    measurementId: "G-BBRC7R8S1M"
};

// Initialize Firebase
// Check if apps are already initialized to avoid "Firebase App named '[DEFAULT]' already exists" error
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let analytics;

// Analytics is only supported in the browser environment
if (typeof window !== 'undefined') {
    isSupported().then((supported) => {
        if (supported) {
            analytics = getAnalytics(app);
        }
    });
}

export { app, analytics };
