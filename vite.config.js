import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],server:{watch:{ignored:['**/.test-artifacts/**','**/tests/**']}},build:{rolldownOptions:{output:{codeSplitting:{groups:[{name:'three',test:/node_modules\/three/},{name:'react',test:/node_modules\/(react|react-dom|scheduler)/}]}}}}});
