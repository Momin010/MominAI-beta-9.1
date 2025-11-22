import { FileSystem } from '../types';
import { FileSystemTree } from '@webcontainer/api';

// Helper to decode a Base64 string into a Uint8Array.
function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function transformFileSystem(fs: FileSystem): FileSystemTree {
    const files: FileSystemTree = {};
    for (const path in fs) {
        const parts = path.split('/');
        let current: any = files;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) {
                current[part] = { directory: {} };
            }
            current = current[part].directory;
        }
        
        const content = fs[path];
        let fileContents: string | Uint8Array;

        // Check for the prefix to identify and decode binary files.
        if (content.startsWith('base64:')) {
            fileContents = base64ToUint8Array(content.substring(7));
        } else {
            fileContents = content;
        }
        
        current[parts[parts.length - 1]] = {
            file: { contents: fileContents },
        };
    }
    return files;
}

interface FileSystemDiff {
    added: { [path: string]: string };
    modified: { [path: string]: string };
    deleted: string[];
}

export function diffFileSystems(oldFs: FileSystem, newFs: FileSystem): FileSystemDiff {
    const added: { [path: string]: string } = {};
    const modified: { [path: string]: string } = {};
    const deleted: string[] = [];

    const oldPaths = Object.keys(oldFs);
    const newPaths = Object.keys(newFs);

    for (const path of newPaths) {
        if (!oldFs.hasOwnProperty(path)) {
            added[path] = newFs[path];
        } else if (oldFs[path] !== newFs[path]) {
            modified[path] = newFs[path];
        }
    }

    for (const path of oldPaths) {
        if (!newFs.hasOwnProperty(path)) {
            deleted.push(path);
        }
    }

    return { added, modified, deleted };
}

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // remove "data:mime/type;base64," prefix
            resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
};