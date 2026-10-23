<script setup lang="ts">
defineOptions({ name: "CompanyChefsRedirectPage" });

const route = useRoute();
await navigateTo(
  `/app/companies/${route.params.companyId}/venues/${route.params.venueId}/schedule`,
);
</script>
