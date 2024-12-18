<script setup lang="ts">
import { ref, onMounted } from 'vue'

async function fetchSubdirectories(dirPath: string) {

try {
    const subdirs: string[] = await window.ipcRenderer.invoke('listSubdirectories', dirPath);
    console.log('Subdirectories BBB:', subdirs);
} catch (err) {
    console.error('Error reading directory:', err);
}
}

fetchSubdirectories('/run/media/deck/NetDisk/Games/Gal');

</script>