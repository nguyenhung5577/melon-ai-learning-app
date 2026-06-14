import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  QueryConstraint,
  CollectionReference,
  DocumentData,
  WithFieldValue,
  UpdateData,
} from "firebase/firestore";

/**
 * Get a single document by ID from a collection
 */
export async function getDocument<T>(collectionRef: CollectionReference<T>, id: string): Promise<T | null> {
  const docRef = doc(collectionRef, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { ...docSnap.data(), id: docSnap.id };
  }
  return null;
}

/**
 * Query documents from a collection with optional constraints
 */
export async function queryDocuments<T>(
  collectionRef: CollectionReference<T>,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collectionRef, ...constraints);
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  }));
}

/**
 * Set a document (create or overwrite)
 */
export async function setDocument<T extends DocumentData>(
  collectionRef: CollectionReference<T>,
  id: string,
  data: WithFieldValue<T>,
  merge: boolean = true
): Promise<void> {
  const docRef = doc(collectionRef, id);
  await setDoc(docRef, data, { merge });
}

/**
 * Update an existing document
 */
export async function updateDocument<T extends DocumentData>(
  collectionRef: CollectionReference<T>,
  id: string,
  data: UpdateData<T>
): Promise<void> {
  const docRef = doc(collectionRef, id);
  await updateDoc(docRef, data);
}

/**
 * Add a new document with an auto-generated ID
 */
export async function addDocument<T extends DocumentData>(
  collectionRef: CollectionReference<T>,
  data: WithFieldValue<T>
): Promise<string> {
  const docRef = await addDoc(collectionRef, data);
  return docRef.id;
}

/**
 * Delete a document by ID
 */
export async function deleteDocument<T>(
  collectionRef: CollectionReference<T>,
  id: string
): Promise<void> {
  const docRef = doc(collectionRef, id);
  await deleteDoc(docRef);
}
