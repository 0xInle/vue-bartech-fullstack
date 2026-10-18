<script setup lang="ts">
const route = useRoute();
await navigateTo(
  `/app/companies/${route.params.companyId}/venues/${route.params.venueId}/management`,
);
</script>
