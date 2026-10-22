/* Firebase leaderboard */
window.Leaderboard = (() => {
    'use strict';

    // Your web app's Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyCzjKe7J0REFL-eku83LPmyrevYpUfDA7Y",
        authDomain: "fighter-db-89873.firebaseapp.com",
        databaseURL: "https://fighter-db-89873.firebaseio.com",
        projectId: "fighter-db-89873",
        storageBucket: "fighter-db-89873.appspot.com",
        messagingSenderId: "806782425742",
        appId: "1:806782425742:web:e034d66f8900e46d3307df",
        measurementId: "G-YM9LFCMR5J"
    };

    let scoresRef = null;
    try {
        firebase.initializeApp(firebaseConfig);
        scoresRef = firebase.database().ref('messages');
    } catch (err) {
        console.warn('Leaderboard unavailable:', err);
    }

    function save(name, score, stage) {
        if (!scoresRef) return Promise.reject(new Error('offline'));
        return scoresRef.push().set({ name, score, stage });
    }

    function top(limit) {
        if (!scoresRef) return Promise.resolve([]);
        return scoresRef.orderByChild('score').limitToLast(limit).once('value').then(snapshot => {
            const rows = [];
            snapshot.forEach(child => { rows.push(child.val()); });
            return rows.sort((a, b) => (b.score || 0) - (a.score || 0));
        });
    }

    return { save, top };
})();
