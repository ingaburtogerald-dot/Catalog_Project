import { getFirebaseAuth, signInWithEmailAndPassword } from '../services/firebaseAuth';
import { getMe } from '../services/authApi';

export class EmailStrategy {
  constructor(email, password) {
    this.email = email;
    this.password = password;
  }

  async execute() {
    const auth = await getFirebaseAuth();
    const result = await signInWithEmailAndPassword(auth, this.email, this.password);
    const token = await result.user.getIdToken();
    const me = await getMe(token);
    const roles = me.roles || (me.role ? [me.role] : []);
    return {
      uid: result.user.uid,
      email: me.email,
      name: result.user.displayName || me.email.split('@')[0],
      photoURL: result.user.photoURL || '',
      role: me.role,
      roles,
      getIdToken: () => result.user.getIdToken(),
    };
  }
}
